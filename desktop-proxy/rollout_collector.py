"""Incrementally retain normalized messages from newly appended rollout lines."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sqlite3
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rollout_monitor import _FileState, _scan
from rollout_normalizer import normalize_lines


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _hash(*parts: str) -> str:
    return hashlib.sha256("\0".join(parts).encode("utf-8")).hexdigest()


def _header(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as stream:
            line = stream.readline(1024 * 1024)
        row = json.loads(line.decode("utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return {}
    payload = row.get("payload") if isinstance(row, dict) else None
    if not isinstance(payload, dict):
        return {}
    originator = payload.get("originator")
    source_app = (
        "Codex CLI (TUI)" if originator == "codex-tui" else
        "Codex Desktop" if originator in {"Codex Desktop", "codex_work_desktop"} else
        originator if isinstance(originator, str) else "unknown"
    )
    source = payload.get("source")
    return {
        "thread_id": payload.get("session_id") if isinstance(payload.get("session_id"), str) else None,
        "parent_thread_id": payload.get("parent_thread_id") if isinstance(payload.get("parent_thread_id"), str) else None,
        "agent_nickname": payload.get("agent_nickname") if isinstance(payload.get("agent_nickname"), str) else None,
        "source_app": source_app,
        "source_label": source if isinstance(source, str) else "unknown",
        "is_subagent": (isinstance(source, dict) and "subagent" in source)
        or payload.get("thread_source") == "subagent",
    }


class RolloutCollector:
    """Single-process SQLite collector; commits messages and byte cursors together."""

    def __init__(self, root: Path, database: Path, collaborator_code: str):
        self.root = Path(root).expanduser()
        self.database = Path(database).expanduser()
        self.collaborator_code = collaborator_code
        self.database.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.database, timeout=10)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=FULL")
        self.connection.execute("PRAGMA busy_timeout=10000")
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS collector_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rollouts (
                relative_path TEXT PRIMARY KEY,
                device INTEGER,
                inode INTEGER,
                size_bytes INTEGER NOT NULL,
                modified_ns INTEGER NOT NULL,
                cursor_offset INTEGER NOT NULL,
                thread_id TEXT,
                parent_thread_id TEXT,
                agent_nickname TEXT,
                source_app TEXT NOT NULL,
                source_label TEXT NOT NULL,
                is_subagent INTEGER NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                event_id TEXT PRIMARY KEY,
                fingerprint TEXT,
                relative_path TEXT NOT NULL REFERENCES rollouts(relative_path),
                thread_id TEXT,
                turn_id TEXT,
                collaborator_code TEXT NOT NULL,
                identity_status TEXT NOT NULL,
                event_type TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                source_app TEXT NOT NULL,
                sources_json TEXT NOT NULL,
                item_ids_json TEXT NOT NULL,
                attachment_kinds_json TEXT NOT NULL,
                byte_offsets_json TEXT NOT NULL,
                rollout_paths_json TEXT NOT NULL DEFAULT '[]',
                captured_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS messages_by_fingerprint
                ON messages(relative_path, fingerprint);
            CREATE INDEX IF NOT EXISTS messages_by_thread
                ON messages(thread_id, turn_id);
        """)
        self._migrate_schema()

    def _migrate_schema(self) -> None:
        for table, column, definition in (
            ("rollouts", "parent_thread_id", "TEXT"),
            ("rollouts", "agent_nickname", "TEXT"),
            ("messages", "rollout_paths_json", "TEXT NOT NULL DEFAULT '[]'"),
        ):
            columns = {row["name"] for row in self.connection.execute(f"PRAGMA table_info({table})")}
            if column not in columns:
                self.connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        with self.connection:
            self.connection.execute(
                "UPDATE messages SET rollout_paths_json=json_array(relative_path) "
                "WHERE rollout_paths_json='[]'"
            )
            if self.connection.execute(
                "SELECT 1 FROM collector_meta WHERE key='subagent_backfill_v3'"
            ).fetchone() is None:
                self.connection.execute("""
                    UPDATE rollouts SET size_bytes=0, cursor_offset=0, status='active', updated_at=?
                    WHERE is_subagent=1
                """, (_now(),))
                self.connection.execute(
                    "INSERT INTO collector_meta(key, value) VALUES ('subagent_backfill_v3', '1')"
                )

    def close(self) -> None:
        self.connection.close()

    def poll(self) -> dict[str, int | str]:
        current = _scan(self.root)
        result: Counter[str] = Counter()
        if self.connection.execute(
            "SELECT 1 FROM collector_meta WHERE key='baseline_complete'"
        ).fetchone() is None:
            self._establish_baseline(current)
            return {"status": "baseline", "files": len(current), "messages": 0,
                    "gaps": 0, "missing": 0, "errors": 0}

        known = {
            row["relative_path"]: row
            for row in self.connection.execute("SELECT * FROM rollouts")
        }
        for relative_path, after in current.items():
            previous = known.pop(relative_path, None)
            if previous is None:
                self._capture_new_file(relative_path, after, result)
            else:
                self._update_file(relative_path, previous, after, result)

        missing = [path for path in known if known[path]["status"] != "missing"]
        if missing:
            with self.connection:
                self.connection.executemany(
                    "UPDATE rollouts SET status='missing', updated_at=? WHERE relative_path=?",
                    [(_now(), path) for path in missing],
                )
            result["missing"] += len(missing)

        return {"status": "poll", "files": len(current), "messages": result["messages"],
                "gaps": result["gaps"], "missing": result["missing"],
                "errors": result["errors"]}

    def _establish_baseline(self, current: dict[str, _FileState]) -> None:
        with self.connection:
            for relative_path, state in current.items():
                metadata = _header(self.root / relative_path)
                self.connection.execute("""
                    INSERT OR IGNORE INTO rollouts
                    (relative_path, device, inode, size_bytes, modified_ns, cursor_offset,
                     thread_id, parent_thread_id, agent_nickname, source_app, source_label,
                     is_subagent, status, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (relative_path, *(state.identity or (None, None)), state.size_bytes,
                      state.modified_ns, state.size_bytes, metadata.get("thread_id"),
                      metadata.get("parent_thread_id"), metadata.get("agent_nickname"),
                      metadata.get("source_app", "unknown"), metadata.get("source_label", "unknown"),
                      int(metadata.get("is_subagent", False)), "baseline", _now()))
            self.connection.execute(
                "INSERT INTO collector_meta(key, value) VALUES ('baseline_complete', '1')"
            )

    def _capture_new_file(self, relative_path: str, state: _FileState, result: Counter[str]) -> None:
        path = self.root / relative_path
        metadata = _header(path)
        identity = state.identity or (None, None)
        with self.connection:
            self.connection.execute("""
                INSERT INTO rollouts
                (relative_path, device, inode, size_bytes, modified_ns, cursor_offset,
                 thread_id, parent_thread_id, agent_nickname, source_app, source_label,
                 is_subagent, status, updated_at)
                VALUES (?, ?, ?, 0, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (relative_path, *identity, state.modified_ns, metadata.get("thread_id"),
                  metadata.get("parent_thread_id"), metadata.get("agent_nickname"),
                  metadata.get("source_app", "unknown"), metadata.get("source_label", "unknown"),
                  int(metadata.get("is_subagent", False)), "active", _now()))
        self._ingest_delta(relative_path, 0, state, result)

    def _update_file(
        self, relative_path: str, previous: sqlite3.Row, after: _FileState,
        result: Counter[str],
    ) -> None:
        old_identity = (previous["device"], previous["inode"])
        replaced = (after.identity is not None and any(value is not None for value in old_identity)
                    and old_identity != after.identity)
        shrank = after.size_bytes < previous["size_bytes"]
        same_size_modified = (after.size_bytes == previous["size_bytes"]
                              and after.modified_ns != previous["modified_ns"])
        if previous["status"] == "missing" or replaced or shrank or same_size_modified:
            self._save_state(relative_path, after, after.size_bytes, "gap")
            result["gaps"] += 1
            return
        if after.size_bytes <= previous["size_bytes"]:
            return
        self._ingest_delta(relative_path, previous["cursor_offset"], after, result)

    def _ingest_delta(
        self, relative_path: str, offset: int, state: _FileState,
        result: Counter[str],
    ) -> None:
        path = self.root / relative_path
        try:
            with path.open("rb") as stream:
                before = stream.fileno()
                before_stat = os.fstat(before)
                if not _matches(before_stat, state):
                    result["errors"] += 1
                    return
                stream.seek(offset)
                data = stream.read(max(0, state.size_bytes - offset))
                after_stat = os.fstat(before)
            if not _matches(after_stat, state):
                result["errors"] += 1
                return
        except OSError:
            result["errors"] += 1
            return

        newline_end = data.rfind(b"\n") + 1
        complete = data[:newline_end]
        next_offset = offset + newline_end
        if not complete:
            self._save_state(relative_path, state, next_offset, "active")
            return
        raw_lines = complete.splitlines(keepends=True)
        offsets: dict[int, int] = {}
        line_start = offset
        lines: list[str] = []
        for ordinal, raw in enumerate(raw_lines, start=1):
            offsets[ordinal] = line_start
            line_start += len(raw)
            lines.append(raw.decode("utf-8", errors="replace").rstrip("\r\n"))
        normalized = normalize_lines(lines, include_content=True)
        metadata = _header(path) if offset == 0 else None
        file_row = self.connection.execute(
            "SELECT * FROM rollouts WHERE relative_path=?", (relative_path,)
        ).fetchone()
        thread_id = (metadata or {}).get("thread_id") or (file_row["thread_id"] if file_row else None)
        source_app = (metadata or {}).get("source_app") or (file_row["source_app"] if file_row else "unknown")
        parent_thread_id = ((metadata or {}).get("parent_thread_id") or
                            (file_row["parent_thread_id"] if file_row else None))
        agent_nickname = ((metadata or {}).get("agent_nickname") or
                          (file_row["agent_nickname"] if file_row else None))
        attachments: dict[str, dict[str, int]] = {}
        for observation in normalized["observations"]:
            reference = observation.get("content_ref")
            if reference:
                target = attachments.setdefault(reference, {})
                for kind, count in observation.get("attachment_kinds", {}).items():
                    target[kind] = target.get(kind, 0) + count
        turns = {turn["turn_id"]: turn for turn in normalized["turns"]}

        with self.connection:
            for message in normalized["messages"]:
                content = "\n".join(part["text"] for part in message["text_parts"])
                if not content or message["role"] not in {"user", "assistant"}:
                    continue
                turn_id = message.get("turn_id")
                message_thread_id = message.get("thread_id") or thread_id
                sources = sorted({item["source"] for item in message["source_occurrences"]})
                byte_offsets = sorted({offsets[item["ordinal"]]
                                       for item in message["source_occurrences"]
                                       if item["ordinal"] in offsets})
                item_ids = sorted(set(message.get("item_ids", [])))
                fingerprint = (_hash(message_thread_id or "", turn_id, message["role"], content)
                               if turn_id else None)
                if self._merge_existing_item(
                    relative_path, message_thread_id, parent_thread_id, message["role"],
                    content, item_ids, sources,
                ):
                    continue
                if fingerprint and self._merge_cross_source(
                    relative_path, fingerprint, sources, item_ids, byte_offsets
                ):
                    result["messages"] += 0
                    continue
                event_id = _hash(relative_path, message.get("content_id", ""),
                                 message["role"], json.dumps(byte_offsets))
                turn = turns.get(turn_id, {})
                self.connection.execute("""
                    INSERT OR IGNORE INTO messages
                    (event_id, fingerprint, relative_path, thread_id, turn_id, collaborator_code,
                     identity_status, event_type, role, content, source_app, sources_json,
                     item_ids_json, attachment_kinds_json, byte_offsets_json,
                     rollout_paths_json, captured_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (event_id, fingerprint, relative_path, message_thread_id, turn_id,
                      self.collaborator_code, "locally_registered_inferred",
                      "prompt" if message["role"] == "user" else "response", message["role"],
                      content, source_app, json.dumps(sources), json.dumps(item_ids),
                      json.dumps(attachments.get(message["content_id"], {})),
                      json.dumps(byte_offsets), json.dumps([relative_path]), _now()))
                result["messages"] += self.connection.execute("SELECT changes()").fetchone()[0]
            self.connection.execute("""
                UPDATE rollouts SET device=?, inode=?, size_bytes=?, modified_ns=?,
                    cursor_offset=?, thread_id=COALESCE(?, thread_id),
                    parent_thread_id=COALESCE(?, parent_thread_id),
                    agent_nickname=COALESCE(?, agent_nickname),
                    source_app=CASE WHEN ?='unknown' THEN source_app ELSE ? END,
                    status='active', updated_at=? WHERE relative_path=?
            """, (*(state.identity or (None, None)), state.size_bytes, state.modified_ns,
                  next_offset, thread_id, parent_thread_id, agent_nickname,
                  source_app, source_app, _now(), relative_path))

    def _merge_existing_item(
        self, relative_path: str, thread_id: str | None, parent_thread_id: str | None,
        role: str, content: str, item_ids: list[str], sources: list[str],
    ) -> bool:
        for item_id in item_ids:
            rows = self.connection.execute("""
                SELECT m.event_id, m.relative_path, m.thread_id, m.rollout_paths_json,
                       m.sources_json, m.item_ids_json, r.parent_thread_id AS candidate_parent
                FROM messages m JOIN rollouts r ON r.relative_path=m.relative_path
                WHERE m.role=? AND m.content=?
                  AND EXISTS (SELECT 1 FROM json_each(m.item_ids_json) WHERE value=?)
            """, (role, content, item_id))
            for row in rows:
                related = (
                    row["relative_path"] == relative_path
                    or (parent_thread_id is not None and row["thread_id"] == parent_thread_id)
                    or (thread_id is not None and row["candidate_parent"] == thread_id)
                    or (parent_thread_id is not None and row["candidate_parent"] == parent_thread_id)
                )
                if not related:
                    continue
                paths = set(json.loads(row["rollout_paths_json"])) | {relative_path}
                old_sources = set(json.loads(row["sources_json"]))
                old_ids = set(json.loads(row["item_ids_json"]))
                self.connection.execute("""
                    UPDATE messages SET rollout_paths_json=?, sources_json=?, item_ids_json=?
                    WHERE event_id=?
                """, (json.dumps(sorted(paths)), json.dumps(sorted(old_sources | set(sources))),
                      json.dumps(sorted(old_ids | set(item_ids))), row["event_id"]))
                return True
        return False

    def _merge_cross_source(
        self, relative_path: str, fingerprint: str, sources: list[str],
        item_ids: list[str], byte_offsets: list[int],
    ) -> bool:
        rows = self.connection.execute(
            "SELECT event_id, sources_json, item_ids_json, byte_offsets_json FROM messages "
            "WHERE relative_path=? AND fingerprint=? ORDER BY captured_at",
            (relative_path, fingerprint),
        )
        incoming = set(sources)
        for row in rows:
            old_sources = set(json.loads(row["sources_json"]))
            if old_sources.isdisjoint(incoming):
                self.connection.execute("""
                    UPDATE messages SET sources_json=?, item_ids_json=?, byte_offsets_json=?
                    WHERE event_id=?
                """, (json.dumps(sorted(old_sources | incoming)),
                      json.dumps(sorted(set(json.loads(row["item_ids_json"])) | set(item_ids))),
                      json.dumps(sorted(set(json.loads(row["byte_offsets_json"])) | set(byte_offsets))),
                      row["event_id"]))
                return True
        return False

    def _save_state(self, relative_path: str, state: _FileState, cursor: int, status: str) -> None:
        with self.connection:
            self.connection.execute("""
                UPDATE rollouts SET device=?, inode=?, size_bytes=?, modified_ns=?,
                    cursor_offset=?, status=?, updated_at=? WHERE relative_path=?
            """, (*(state.identity or (None, None)), state.size_bytes, state.modified_ns,
                  cursor, status, _now(), relative_path))

def _matches(info: Any, state: _FileState) -> bool:
    if (info.st_size, info.st_mtime_ns) != (state.size_bytes, state.modified_ns):
        return False
    return state.identity is None or (info.st_dev, info.st_ino) == state.identity


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.home() / ".codex" / "sessions")
    parser.add_argument("--database", type=Path,
                        default=Path(__file__).resolve().parent / "analise" / "rollout-monitor.sqlite3")
    parser.add_argument("--collaborator-code", required=True)
    parser.add_argument("--interval", type=float, default=1.0, help="seconds between metadata scans")
    parser.add_argument("--once", action="store_true", help="scan once and exit")
    args = parser.parse_args(argv)
    if not args.collaborator_code or len(args.collaborator_code) > 64:
        parser.error("--collaborator-code must contain 1 to 64 characters")
    if not math.isfinite(args.interval) or args.interval <= 0:
        parser.error("--interval must be a positive finite number")

    collector = RolloutCollector(args.root, args.database, args.collaborator_code)
    try:
        while True:
            try:
                result = collector.poll()
            except OSError as exc:
                result = {"status": "scan_error", "error_class": type(exc).__name__}
            if args.once or result.get("status") != "poll" or any(
                result.get(key, 0) for key in ("messages", "gaps", "missing", "errors")
            ):
                print(json.dumps(result, ensure_ascii=False), flush=True)
            if args.once:
                return 0
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return 0
    finally:
        collector.close()


if __name__ == "__main__":
    raise SystemExit(main())
