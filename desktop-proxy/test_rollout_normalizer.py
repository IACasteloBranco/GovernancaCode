import json
import unittest

from rollout_normalizer import normalize_lines


def line(record):
    return json.dumps(record)


class RolloutNormalizerTests(unittest.TestCase):
    def test_projects_mcp_tool_metadata_without_arguments_or_results(self):
        secret_arguments = "SYNTHETIC_MCP_ARGUMENTS_MUST_NOT_LEAK"
        secret_result = "SYNTHETIC_MCP_RESULT_MUST_NOT_LEAK"
        record = line({"type": "event_msg", "payload": {
            "type": "item_completed", "thread_id": "thread-1", "turn_id": "turn-1",
            "started_at_ms": 100, "completed_at_ms": 137,
            "item": {
                "type": "McpToolCall", "id": "mcp-item-1", "server": "cua_repl",
                "tool": "js", "status": "completed", "arguments": secret_arguments,
                "result": secret_result,
            },
        }})

        result = normalize_lines([record], include_content=True)
        call = result["mcp_tool_calls"][0]
        observation = result["observations"][0]
        serialized = json.dumps(result)

        self.assertEqual(result["schema_version"], 3)
        self.assertEqual(call["item_id"], "mcp-item-1")
        self.assertEqual(call["thread_id"], "thread-1")
        self.assertEqual(call["turn_id"], "turn-1")
        self.assertEqual(call["tool_server"], "cua_repl")
        self.assertEqual(call["tool_name"], "js")
        self.assertEqual(call["status"], "completed")
        self.assertEqual(call["duration_ms"], 37)
        self.assertEqual(observation["source"], "event_msg.item_completed")
        self.assertEqual(result["tool_calls"], [])
        self.assertNotIn(secret_arguments, serialized)
        self.assertNotIn(secret_result, serialized)

    def test_preserves_sources_and_pairs_turn_without_emitting_content(self):
        secret_text = "SYNTHETIC_PROMPT_MUST_NOT_LEAK"
        secret_args = "SYNTHETIC_ARGUMENTS_MUST_NOT_LEAK"
        secret_output = "SYNTHETIC_TOOL_OUTPUT_MUST_NOT_LEAK"
        records = [
            {"type": "event_msg", "payload": {"type": "task_started", "turn_id": "turn-1"}},
            {"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-1", "started_at_ms": 100,
                "completed_at_ms": 101, "item": {
                "type": "message", "id": "item-1", "role": "user", "content": [{"type": "text", "text": secret_text}]
            }}},
            {"type": "response_item", "payload": {
                "type": "message", "id": "item-1", "role": "user", "content": [{"type": "input_text", "text": secret_text}],
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-1"}
            }},
            {"type": "response_item", "payload": {
                "type": "function_call", "id": "call-item", "call_id": "call-1", "name": "CommandExecution",
                "arguments": secret_args, "status": "completed", "exit_code": 0,
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-1"}
            }},
            {"type": "response_item", "payload": {
                "type": "function_call_output", "id": "output-item", "call_id": "call-1", "output": secret_output,
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-1"}
            }},
            {"type": "compacted", "payload": {}},
            {"type": "event_msg", "payload": {"type": "task_complete", "turn_id": "turn-1"}},
        ]
        result = normalize_lines(map(line, records))
        serialized = json.dumps(result)

        self.assertNotIn(secret_text, serialized)
        self.assertNotIn(secret_args, serialized)
        self.assertNotIn(secret_output, serialized)
        self.assertEqual([o["source"] for o in result["observations"] if o.get("item_id") == "item-1"],
                         ["event_msg.item_completed", "response_item"])
        self.assertEqual(result["turns"][0]["task_state"], "paired")
        self.assertEqual(result["turns"][0]["compaction_context"], "overlaps_marker")
        call = next(o for o in result["observations"] if o.get("call_id") == "call-1")
        self.assertEqual(call["exit_class"], "zero")
        self.assertNotIn("arguments", call)
        self.assertEqual(result["tool_calls"][0]["pairing_state"], "paired")
        self.assertEqual(result["observations"][1]["completed_at_ms"], 101)
        self.assertEqual(result["content_mode"], "metadata_only")
        self.assertEqual(result["messages"], [])

        retained = normalize_lines(map(line, records), include_content=True)
        content = next(message for message in retained["messages"] if message.get("item_id") == "item-1")
        self.assertEqual(content["role"], "user")
        self.assertEqual(content["text_parts"], [{"type": "text", "text": secret_text}])
        self.assertEqual(len(content["source_occurrences"]), 2)
        retained_text = json.dumps(retained)
        self.assertNotIn(secret_args, retained_text)
        self.assertNotIn(secret_output, retained_text)
        self.assertEqual(retained["content_mode"], "retained_for_review")

    def test_marks_unpaired_and_unknown_records_without_echoing_payload(self):
        secret = "SYNTHETIC_UNKNOWN_PAYLOAD_MUST_NOT_LEAK"
        result = normalize_lines([
            line({"type": "event_msg", "payload": {"type": "task_started", "turn_id": "turn-2"}}),
            line({"type": "future_secret_type", "payload": {"text": secret}}),
            "not json",
        ])
        serialized = json.dumps(result)
        self.assertNotIn(secret, serialized)
        self.assertEqual(result["turns"][0]["task_state"], "unpaired")
        self.assertEqual(result["summary"]["invalid_ordinals"], [3])
        self.assertEqual(result["observations"][1]["known_type"], False)

    def test_keeps_developer_origin_unknown_and_attachment_kinds_only(self):
        private_label = "SYNTHETIC_FILENAME_MUST_NOT_LEAK"
        result = normalize_lines([line({"type": "response_item", "payload": {
            "type": "message", "id": "dev-1", "role": "developer", "turn_id": "turn-3",
            "content": [{"type": "input_file", "filename": private_label, "size": 10}]
        }})])
        observation = result["observations"][0]
        self.assertEqual(observation["origin"], "unknown")
        self.assertEqual(observation["attachment_kinds"], {"input_file": 1})
        self.assertNotIn(private_label, json.dumps(result))

    def test_retains_only_user_and_assistant_text_and_flags_conflicts(self):
        records = [
            {"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-4", "item": {
                "type": "UserMessage", "id": "same-id", "content": {"text": "synthetic user text"}
            }}},
            {"type": "response_item", "payload": {
                "type": "message", "id": "same-id", "role": "user",
                "content": [{"type": "input_text", "text": "different synthetic text"}]
            }},
            {"type": "response_item", "payload": {
                "type": "message", "id": "developer-id", "role": "developer",
                "content": [{"type": "text", "text": "synthetic developer instruction"}]
            }},
            {"type": "response_item", "payload": {
                "type": "function_call", "id": "tool-id", "call_id": "call-4",
                "arguments": "synthetic tool arguments"
            }},
            {"type": "response_item", "payload": {
                "type": "message", "id": "attachment-id", "role": "user",
                "content": [{"type": "input_file", "filename": "synthetic-secret.txt",
                             "data": "synthetic attachment bytes"}]
            }},
            {"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-4", "item": {
                "type": "AgentMessage", "id": "assistant-id",
                "content": {"text": "synthetic assistant response"}
            }}}
        ]
        result = normalize_lines(map(line, records), include_content=True)
        serialized = json.dumps(result)
        self.assertIn("synthetic user text", serialized)
        self.assertIn("different synthetic text", serialized)
        self.assertIn("synthetic assistant response", serialized)
        self.assertNotIn("synthetic developer instruction", serialized)
        self.assertNotIn("synthetic tool arguments", serialized)
        self.assertNotIn("synthetic-secret.txt", serialized)
        self.assertNotIn("synthetic attachment bytes", serialized)
        self.assertEqual(len(result["content_conflicts"]), 1)
        self.assertEqual(len(result["messages"]), 3)
        self.assertEqual(sum(message["content_conflict"] for message in result["messages"]), 2)

    def test_deduplicates_cross_source_messages_without_merging_repeated_turn_text(self):
        duplicate_text = "synthetic repeated prompt"
        records = [
            {"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-a", "item": {
                "type": "UserMessage", "id": "event-id", "content": {"text": duplicate_text}
            }}},
            {"type": "response_item", "payload": {
                "type": "message", "id": "response-id", "role": "user",
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-a"},
                "content": [{"type": "input_text", "text": duplicate_text}]
            }},
            {"type": "response_item", "payload": {
                "type": "message", "id": "same-source-id", "role": "user",
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-a"},
                "content": [{"type": "input_text", "text": duplicate_text}]
            }},
            {"type": "response_item", "payload": {
                "type": "message", "id": "next-turn-id", "role": "user",
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-b"},
                "content": [{"type": "input_text", "text": duplicate_text}]
            }},
        ]

        result = normalize_lines(map(line, records), include_content=True)

        self.assertEqual(len(result["messages"]), 3)
        merged = result["messages"][0]
        self.assertEqual(merged["item_ids"], ["event-id", "response-id"])
        self.assertEqual({item["source"] for item in merged["source_occurrences"]},
                         {"event_msg.item_completed", "response_item"})
        self.assertEqual(result["summary"]["cross_source_duplicates_merged"], 1)
        self.assertEqual(result["observations"][0]["content_ref"], result["observations"][1]["content_ref"])
        self.assertNotEqual(result["messages"][1]["content_id"], result["messages"][2]["content_id"])

    def test_does_not_guess_turn_for_item_without_turn_id(self):
        result = normalize_lines([line({"type": "response_item", "payload": {
            "type": "message", "id": "item-no-turn", "role": "assistant", "content": []
        }})])
        self.assertEqual(result["observations"][0]["association"], "unassigned")
        self.assertEqual(result["turns"], [])

    def test_matches_reasoning_item_identity_across_type_casing(self):
        result = normalize_lines([
            line({"type": "event_msg", "payload": {"type": "item_completed", "item": {
                "type": "Reasoning", "id": "reasoning-1"
            }}}),
            line({"type": "response_item", "payload": {
                "type": "reasoning", "id": "reasoning-1"
            }}),
        ])
        self.assertEqual(result["identity_conflicts"], [])
        self.assertTrue(all(observation["known_type"] for observation in result["observations"]))


if __name__ == "__main__":
    unittest.main()
