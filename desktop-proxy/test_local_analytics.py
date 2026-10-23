import json
import unittest
from uuid import uuid4
from pathlib import Path
from unittest.mock import patch

from local_analytics import build_analytics, write_dashboard


class LocalAnalyticsTests(unittest.TestCase):
    def test_builds_offline_events_with_one_identity_and_excludes_subagents(self):
        sessions = Path(__file__).parent / "analise"
        suffix = uuid4().hex
        main_path = sessions / f"rollout-test-{suffix}.jsonl"
        child_path = sessions / f"rollout-test-child-{suffix}.jsonl"
        output = sessions / f"analytics-test-{suffix}.html"
        try:
            thread_id = "thread-synthetic"
            records = [
                {"type": "session_meta", "payload": {
                    "session_id": thread_id, "source": "vscode", "originator": "Codex Desktop",
                    "thread_source": "user", "timestamp": "2026-10-22T10:00:00Z",
                }},
                {"type": "event_msg", "payload": {"type": "task_started", "turn_id": "turn-1"}},
                {"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-1", "item": {
                    "type": "UserMessage", "id": "user-item", "content": "SYNTHETIC PROMPT </script>",
                }}},
                {"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-1", "item": {
                    "type": "AgentMessage", "id": "assistant-item", "content": "SYNTHETIC RESPONSE",
                }}},
                {"type": "event_msg", "payload": {"type": "task_complete", "turn_id": "turn-1"}},
                {"type": "response_item", "payload": {"type": "function_call", "call_id": "call-1",
                    "name": "CommandExecution", "arguments": "SYNTHETIC TOOL ARGUMENT MUST NOT LEAK"}},
            ]
            main_path.write_text(
                "\n".join(json.dumps(record) for record in records) + "\n", encoding="utf-8"
            )
            subagent_meta = {"type": "session_meta", "payload": {
                "session_id": "child-thread", "source": {"subagent": {"other": "test"}},
                "thread_source": "subagent",
            }}
            child_path.write_text(json.dumps(subagent_meta) + "\n", encoding="utf-8")

            data = build_analytics(sessions, "COLAB-LOCAL-TEST")
            self.assertEqual(data["report"]["primary_rollouts"], 1)
            self.assertEqual(data["report"]["subagent_rollouts_excluded"], 1)
            self.assertEqual(data["summary"]["prompts"], 1)
            self.assertEqual(data["summary"]["responses"], 1)
            self.assertEqual(data["sessions"][0]["collaborator_code"], "COLAB-LOCAL-TEST")
            self.assertEqual(data["sessions"][0]["events"][0]["capture_status"], "paired")
            self.assertEqual(data["sessions"][0]["events"][0]["platform"], "codex_local")
            self.assertEqual(data["sessions"][0]["events"][0]["source_app"], "Codex Desktop")

            write_dashboard(data, output)
            html = output.read_text(encoding="utf-8")
            self.assertIn("SYNTHETIC PROMPT", html)
            self.assertIn(r"\u003c/script\u003e", html)
            self.assertIn("Eduardo Sobreira Alves Pires · IA", html)
            self.assertIn("${collaborator} · ${event.collaborator_code} · ${event.source_app}", html)
            self.assertIn('id="filter-code"', html)
            self.assertIn("event.collaborator_code.toLocaleLowerCase() === code", html)
            self.assertNotIn('id="search-text"', html)
            self.assertNotIn("thread ${event.thread_id}", html)
            self.assertNotIn("turno ${event.turn_id}", html)
            self.assertNotIn("captura ${event.capture_status}", html)
            self.assertIn(".brand-mark", html)
            self.assertIn("id=\"interaction-pagination\"", html)
            self.assertNotIn("fetch(", html)
            self.assertNotIn("SYNTHETIC TOOL ARGUMENT MUST NOT LEAK", html)
            self.assertNotIn("child-thread", html)
        finally:
            for path in (main_path, child_path, output):
                path.unlink(missing_ok=True)

    def test_retries_rollout_that_changes_during_read(self):
        root = Path(__file__).parent / "analise"
        source = root / f"rollout-test-stable-{uuid4().hex}.jsonl"
        source.write_text(json.dumps({"type": "session_meta", "payload": {
            "session_id": "thread-stable", "source": "vscode", "originator": "codex-tui",
            "thread_source": "user",
        }}) + "\n", encoding="utf-8")
        try:
            with patch("local_analytics._file_state", side_effect=[(1, 1), (2, 2), (2, 2), (2, 2)]):
                data = build_analytics(root, "COLAB-LOCAL-TEST")
            self.assertEqual(data["report"]["primary_rollouts"], 1)
            self.assertEqual(data["report"]["unstable_rollouts_skipped"], 0)
            self.assertEqual(data["sessions"][0]["thread_id"], "thread-stable")
            self.assertEqual(data["sessions"][0]["source_app"], "Codex CLI (TUI)")
        finally:
            source.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
