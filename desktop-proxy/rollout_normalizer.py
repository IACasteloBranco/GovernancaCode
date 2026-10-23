"""Normalize Codex rollout JSONL files with optional message-text retention."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from typing import Any, Iterable


_SAFE_TOKEN = re.compile(r"^[A-Za-z0-9_.:-]{1,100}$")
_KNOWN_ITEM_TYPES = {
    "message",
    "UserMessage",
    "AgentMessage",
    "CommandExecution",
    "WebSearch",
    "McpToolCall",
    "function_call",
    "function_call_output",
    "custom_tool_call",
    "custom_tool_call_output",
    "reasoning",
    "Reasoning",
    "image",
}
_KNOWN_TOP_TYPES = {"event_msg", "response_item", "compacted", "session_meta"}
_KNOWN_EVENT_TYPES = {"task_started", "task_complete", "item_completed"}
_MESSAGE_TYPES = {"message", "UserMessage", "AgentMessage"}
_TEXT_PART_TYPES = {"text", "input_text", "output_text"}
_MESSAGE_SOURCES = {"response_item", "event_msg.item_completed"}


def _token(value: Any) -> str | None:
    return value if isinstance(value, str) and _SAFE_TOKEN.fullmatch(value) else None


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _message_role(item_type: str | None, role: str | None) -> str | None:
    if role is not None:
        return role
    if item_type == "UserMessage":
        return "user"
    if item_type == "AgentMessage":
        return "assistant"
    return None


def _text_parts(item: dict[str, Any]) -> list[dict[str, str]]:
    content = item.get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}] if content else []
    if isinstance(content, dict):
        if isinstance(content.get("text"), str):
            return [{"type": "text", "text": content["text"]}] if content["text"] else []
        content = content.get("parts")
    if not isinstance(content, list):
        return []
    return [
        {"type": "text", "text": part["text"]}
        for part in content
        if isinstance(part, dict)
        and part.get("type") in _TEXT_PART_TYPES
        and isinstance(part.get("text"), str)
        and part["text"]
    ]


def _item_observation(
    item: dict[str, Any], source: str, ordinal: int, turn_id: str | None, thread_id: str | None,
    event_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    item_type = _token(item.get("type"))
    role = _message_role(item_type, _token(item.get("role")))
    content = item.get("content")
    parts = content if isinstance(content, list) else []
    attachment_kinds = Counter(
        kind
        for part in parts
        if isinstance(part, dict)
        for kind in [_token(part.get("type"))]
        if kind and kind not in {"text", "output_text", "input_text"}
    )
    event_payload = event_payload or {}
    started_at = item.get("started_at_ms", event_payload.get("started_at_ms"))
    completed_at = item.get("completed_at_ms", event_payload.get("completed_at_ms"))
    tool_duration_ms = None
    if (item_type == "McpToolCall" and isinstance(started_at, int) and not isinstance(started_at, bool) and
            isinstance(completed_at, int) and not isinstance(completed_at, bool) and completed_at >= started_at):
        tool_duration_ms = completed_at - started_at
    observation = {
        "ordinal": ordinal,
        "source": source,
        "event_type": item_type or "unknown",
        "known_type": item_type in _KNOWN_ITEM_TYPES,
        "item_id": _token(item.get("id")),
        "item_type": item_type,
        "role": role,
        "origin": "unknown" if role == "developer" else None,
        "thread_id": thread_id,
        "turn_id": turn_id,
        "call_id": _token(item.get("call_id")),
        "tool_server": _token(item.get("server")) if item_type == "McpToolCall" else None,
        "tool_name": _token(item.get("tool")) if item_type == "McpToolCall" else _token(item.get("name")),
        "status": _token(item.get("status")),
        "started_at_ms": started_at if isinstance(started_at, (int, float)) else None,
        "completed_at_ms": completed_at if isinstance(completed_at, (int, float)) else None,
        "duration_ms": tool_duration_ms,
        "output_present": ("output" in item) if item_type in {
            "function_call_output", "custom_tool_call_output"
        } else None,
        "text_present": bool(_text_parts(item)),
        "attachment_kinds": dict(sorted(attachment_kinds.items())),
    }
    if _token(item.get("name")) == "CommandExecution" and isinstance(item.get("exit_code"), int):
        observation["exit_class"] = "zero" if item["exit_code"] == 0 else "nonzero"
    return {key: value for key, value in observation.items() if value is not None}


def normalize_lines(lines: Iterable[str], *, include_content: bool = False) -> dict[str, Any]:
    """Return a sanitized occurrence ledger and turn projections.

    By default, only safe metadata is emitted. When explicitly enabled, user and
    assistant text is emitted in a separate message collection; tool arguments,
    results, command data, paths, and raw unknown payloads are never emitted.
    """
    observations: list[dict[str, Any]] = []
    invalid_ordinals: list[int] = []
    top_counts: Counter[str] = Counter()
    unknown_types: Counter[str] = Counter()
    task_positions: dict[str, dict[str, list[int]]] = defaultdict(
        lambda: {"start": [], "complete": []}
    )
    turns_seen: set[str] = set()
    item_identities: dict[str, tuple[str | None, str | None, int]] = {}
    identity_conflicts: list[dict[str, int | str]] = []
    compacted_ordinals: list[int] = []
    messages_by_identity: dict[str, list[dict[str, Any]]] = defaultdict(list)
    messages_by_turn_text: dict[tuple[str, str, tuple[tuple[str, str], ...]], list[dict[str, Any]]] = defaultdict(list)
    content_conflicts: list[dict[str, Any]] = []
    cross_source_duplicates_merged = 0

    for ordinal, line in enumerate(lines, start=1):
        try:
            row = json.loads(line)
        except (json.JSONDecodeError, TypeError):
            invalid_ordinals.append(ordinal)
            continue
        if not isinstance(row, dict):
            invalid_ordinals.append(ordinal)
            continue

        source = _token(row.get("type")) or "unknown"
        payload = _dict(row.get("payload"))
        payload_type = _token(payload.get("type"))
        thread_id = _token(payload.get("thread_id")) or _token(row.get("thread_id"))
        turn_id = _token(payload.get("turn_id"))
        if source == "response_item":
            metadata = _dict(payload.get("internal_chat_message_metadata_passthrough"))
            turn_id = _token(metadata.get("turn_id")) or turn_id
            thread_id = _token(metadata.get("thread_id")) or thread_id
        if turn_id:
            turns_seen.add(turn_id)

        top_counts[source] += 1
        if source not in _KNOWN_TOP_TYPES:
            unknown_types[source] += 1
            observations.append({
                "ordinal": ordinal,
                "source": source,
                "event_type": "unknown",
                "known_type": False,
                "turn_id": turn_id,
                "thread_id": thread_id,
            })
            continue

        if source == "compacted":
            compacted_ordinals.append(ordinal)
            observations.append({
                "ordinal": ordinal,
                "source": source,
                "event_type": "compacted",
                "known_type": True,
                "thread_id": thread_id,
                "turn_id": turn_id,
            })
            continue

        if source == "event_msg" and payload_type in {"task_started", "task_complete"}:
            state = "start" if payload_type == "task_started" else "complete"
            if turn_id:
                task_positions[turn_id][state].append(ordinal)
            observations.append({
                "ordinal": ordinal,
                "source": "event_msg." + payload_type,
                "event_type": payload_type,
                "known_type": True,
                "thread_id": thread_id,
                "turn_id": turn_id,
            })
            continue

        item: dict[str, Any] | None = None
        item_source = source
        if source == "response_item":
            item = payload
        elif source == "event_msg" and payload_type == "item_completed":
            item = _dict(payload.get("item"))
            item_source = "event_msg.item_completed"
        elif source == "event_msg":
            event_known = payload_type in _KNOWN_EVENT_TYPES
            observations.append({
                "ordinal": ordinal,
                "source": "event_msg",
                "event_type": payload_type or "unknown",
                "known_type": event_known,
                "thread_id": thread_id,
                "turn_id": turn_id,
            })
            if not event_known:
                unknown_types[payload_type or "event_msg"] += 1
            continue
        elif source == "session_meta":
            observations.append({
                "ordinal": ordinal,
                "source": source,
                "event_type": "session_meta",
                "known_type": True,
                "thread_id": thread_id,
                "turn_id": turn_id,
            })
            continue

        if item is None:
            observations.append({
                "ordinal": ordinal,
                "source": source,
                "event_type": payload_type or "unknown",
                "known_type": False,
                "thread_id": thread_id,
                "turn_id": turn_id,
            })
            unknown_types[payload_type or source] += 1
            continue

        observation = _item_observation(item, item_source, ordinal, turn_id, thread_id, payload)
        item_id = observation.get("item_id")
        if item_id:
            item_type = observation.get("item_type")
            signature_type = "reasoning" if item_type == "Reasoning" else item_type
            signature = ("message" if signature_type in _MESSAGE_TYPES else signature_type, observation.get("role"))
            previous = item_identities.get(item_id)
            if previous is None:
                item_identities[item_id] = (*signature, ordinal)
                observation["logical_item_id"] = item_id
            elif signature == previous[:2]:
                observation["logical_item_id"] = item_id
            else:
                identity_conflicts.append({"item_id": item_id, "first_ordinal": previous[2], "ordinal": ordinal})
                observation["logical_item_id"] = f"{item_id}@{ordinal}"
        if include_content and observation.get("item_type") in _MESSAGE_TYPES and \
                observation.get("role") in {"user", "assistant"}:
            text_parts = _text_parts(item)
            if text_parts:
                identity = observation.get("logical_item_id") or f"occurrence:{ordinal}"
                variants = messages_by_identity[identity]
                source_occurrence = {"source": item_source, "ordinal": ordinal}
                matching = next((entry for entry in variants if entry["text_parts"] == text_parts), None)
                text_key = tuple((part["type"], part["text"]) for part in text_parts)
                if matching is None and turn_id and item_source in _MESSAGE_SOURCES:
                    other_source = next(iter(_MESSAGE_SOURCES - {item_source}))
                    candidates = [
                        entry for entry in messages_by_turn_text[(turn_id, observation["role"], text_key)]
                        if {occurrence["source"] for occurrence in entry["source_occurrences"]} == {other_source}
                    ]
                    if len(candidates) == 1:
                        matching = candidates[0]
                if matching:
                    existing_sources = {entry["source"] for entry in matching["source_occurrences"]}
                    if item_source in _MESSAGE_SOURCES and item_source not in existing_sources:
                        cross_source_duplicates_merged += 1
                    matching["source_occurrences"].append(source_occurrence)
                    if item_id and item_id not in matching["item_ids"]:
                        matching["item_ids"].append(item_id)
                    observation["content_ref"] = matching["content_id"]
                else:
                    content_id = identity if not variants else f"{identity}#variant-{len(variants) + 1}"
                    message = {
                        "content_id": content_id,
                        "item_id": item_id,
                        "item_ids": [item_id] if item_id else [],
                        "role": observation["role"],
                        "thread_id": thread_id,
                        "turn_id": turn_id,
                        "text_parts": text_parts,
                        "source_occurrences": [source_occurrence],
                        "content_conflict": bool(variants),
                    }
                    if variants:
                        for variant in variants:
                            variant["content_conflict"] = True
                        content_conflicts.append({
                            "logical_item_id": identity,
                            "content_ids": [entry["content_id"] for entry in variants] + [content_id],
                        })
                    variants.append(message)
                    if turn_id:
                        messages_by_turn_text[(turn_id, observation["role"], text_key)].append(message)
                    observation["content_ref"] = content_id
        if observation["event_type"] == "unknown" or not observation["known_type"]:
            unknown_types[observation.get("item_type") or source] += 1
        observations.append(observation)

    for observation in observations:
        observation["association"] = "explicit_turn" if observation.get("turn_id") else "unassigned"

    turns = []
    by_turn: dict[str, list[int]] = defaultdict(list)
    for obs in observations:
        if obs.get("turn_id"):
            by_turn[obs["turn_id"]].append(obs["ordinal"])
    for turn_id in sorted(turns_seen):
        positions = task_positions[turn_id]
        starts, completes = positions["start"], positions["complete"]
        state = "paired" if len(starts) == len(completes) == 1 else (
            "ambiguous" if len(starts) > 1 or len(completes) > 1 else "unpaired"
        )
        turn_ordinals = by_turn.get(turn_id, [])
        first_marker = next((n for n in compacted_ordinals if n > min(turn_ordinals, default=n)), None)
        turn_marker_overlap = any(min(turn_ordinals, default=n) <= n <= max(turn_ordinals, default=n)
                                  for n in compacted_ordinals)
        turns.append({
            "turn_id": turn_id,
            "task_state": state,
            "start_ordinal": starts[0] if len(starts) == 1 else None,
            "complete_ordinal": completes[0] if len(completes) == 1 else None,
            "observation_ordinals": sorted(by_turn.get(turn_id, [])),
            "compaction_context": "overlaps_marker" if turn_marker_overlap else (
                "before_marker" if first_marker else (
                    "after_marker_or_unknown" if compacted_ordinals else "none_observed"
                )
            ),
        })

    tool_groups: dict[tuple[str | None, str], list[dict[str, Any]]] = defaultdict(list)
    for observation in observations:
        if observation.get("call_id"):
            tool_groups[(observation.get("turn_id"), observation["call_id"])].append(observation)
    tool_calls = []
    for (turn_id, call_id), group in sorted(tool_groups.items(), key=lambda pair: (pair[0][0] or "", pair[0][1])):
        calls = [o for o in group if o.get("item_type") in {"function_call", "custom_tool_call"}]
        outputs = [o for o in group if o.get("item_type") in {"function_call_output", "custom_tool_call_output"}]
        state = "paired" if len(calls) == len(outputs) == 1 else (
            "ambiguous" if len(calls) > 1 or len(outputs) > 1 else "unpaired"
        )
        tool_calls.append({
            "call_id": call_id,
            "turn_id": turn_id,
            "call_ordinals": [o["ordinal"] for o in calls],
            "output_ordinals": [o["ordinal"] for o in outputs],
            "pairing_state": state,
            "declared_statuses": [o["status"] for o in calls if o.get("status")],
            "exit_classes": [o["exit_class"] for o in calls if o.get("exit_class")],
        })
    mcp_tool_calls = [
        {key: observation[key] for key in (
            "ordinal", "source", "item_id", "thread_id", "turn_id", "tool_server", "tool_name",
            "status", "started_at_ms", "completed_at_ms", "duration_ms",
        ) if observation.get(key) is not None}
        for observation in observations
        if observation.get("item_type") == "McpToolCall"
    ]

    return {
        "schema_version": 3,
        "content_mode": "retained_for_review" if include_content else "metadata_only",
        "summary": {
            "valid_records": sum(top_counts.values()),
            "invalid_ordinals": invalid_ordinals,
            "record_counts": dict(sorted(top_counts.items())),
            "unknown_type_counts": dict(sorted(unknown_types.items())),
            "compacted_ordinals": compacted_ordinals,
            "retained_message_count": sum(len(variants) for variants in messages_by_identity.values()),
            "cross_source_duplicates_merged": cross_source_duplicates_merged,
        },
        "observations": observations,
        "messages": [message for variants in messages_by_identity.values() for message in variants],
        "turns": turns,
        "tool_calls": tool_calls,
        "mcp_tool_calls": mcp_tool_calls,
        "identity_conflicts": identity_conflicts,
        "content_conflicts": content_conflicts,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rollout", help="path to a rollout JSONL file")
    parser.add_argument("--include-content", action="store_true",
                        help="include user/assistant message text for retrospective review")
    args = parser.parse_args()
    try:
        with open(args.rollout, encoding="utf-8") as source:
            result = normalize_lines(source, include_content=args.include_content)
    except (OSError, UnicodeError) as exc:
        print(f"Could not read input: {exc.__class__.__name__}", file=sys.stderr)
        return 2
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
