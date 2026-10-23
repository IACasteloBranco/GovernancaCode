import json
import shutil
import sqlite3
import unittest
from contextlib import closing, contextmanager
from pathlib import Path
from uuid import uuid4

from rollout_collector import RolloutCollector


def record(value):
    return json.dumps(value, ensure_ascii=False).encode("utf-8") + b"\n"


@contextmanager
def test_directory():
    path = Path(__file__).resolve().parent / f".collector-test-{uuid4().hex}"
    path.mkdir()
    try:
        yield path
    finally:
        shutil.rmtree(path)


class RolloutCollectorTests(unittest.TestCase):
    def test_baselines_history_then_saves_only_new_normalized_messages_once(self):
        with test_directory() as temporary:
            root = temporary / "sessions"
            root.mkdir()
            database = temporary / "collector.sqlite3"
            rollout = root / "rollout-synthetic.jsonl"
            rollout.write_bytes(record({"type": "session_meta", "payload": {
                "session_id": "thread-synthetic", "originator": "codex-tui",
                "thread_source": "user",
            }}) + record({"type": "response_item", "payload": {
                "type": "message", "id": "historical", "role": "user",
                "content": [{"type": "input_text", "text": "SYNTHETIC_OLD_TEXT"}],
            }}))
            collector = RolloutCollector(root, database, "COLAB-LOCAL-TEST")
            try:
                self.assertEqual(collector.poll()["status"], "baseline")
                with closing(sqlite3.connect(database)) as connection:
                    self.assertEqual(connection.execute("SELECT count(*) FROM messages").fetchone()[0], 0)

                additions = b"".join([
                    record({"type": "event_msg", "payload": {"type": "task_started", "turn_id": "turn-new"}}),
                    record({"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-new",
                        "item": {"type": "UserMessage", "id": "new-user", "content": "SYNTHETIC_NEW_PROMPT"}}}),
                    record({"type": "event_msg", "payload": {"type": "item_completed", "turn_id": "turn-new",
                        "item": {"type": "AgentMessage", "id": "new-assistant", "content": "SYNTHETIC_NEW_RESPONSE"}}}),
                    record({"type": "response_item", "payload": {"type": "function_call", "call_id": "call-1",
                        "arguments": "SYNTHETIC_TOOL_ARGUMENT_MUST_NOT_LEAK"}}),
                    record({"type": "event_msg", "payload": {"type": "task_complete", "turn_id": "turn-new"}}),
                ])
                with rollout.open("ab") as stream:
                    stream.write(additions)
                self.assertEqual(collector.poll()["messages"], 2)
                self.assertEqual(collector.poll()["messages"], 0)
            finally:
                collector.close()

            with closing(sqlite3.connect(database)) as connection:
                rows = connection.execute(
                    "SELECT event_type, role, content, source_app, collaborator_code FROM messages ORDER BY role"
                ).fetchall()
            self.assertEqual(len(rows), 2)
            self.assertEqual({row[0] for row in rows}, {"prompt", "response"})
            self.assertEqual({row[3] for row in rows}, {"Codex CLI (TUI)"})
            self.assertEqual({row[4] for row in rows}, {"COLAB-LOCAL-TEST"})
            self.assertNotIn("SYNTHETIC_OLD_TEXT", json.dumps(rows))
            self.assertNotIn("SYNTHETIC_TOOL_ARGUMENT_MUST_NOT_LEAK", json.dumps(rows))

    def test_resumes_after_restart_and_marks_truncation_without_deleting_events(self):
        with test_directory() as temporary:
            root = temporary / "sessions"
            root.mkdir()
            database = temporary / "collector.sqlite3"
            rollout = root / "rollout-synthetic.jsonl"
            rollout.write_bytes(record({"type": "session_meta", "payload": {
                "session_id": "thread-synthetic", "originator": "Codex Desktop",
            }}))
            first = RolloutCollector(root, database, "COLAB-LOCAL-TEST")
            first.poll()
            first.close()

            with rollout.open("ab") as stream:
                stream.write(record({"type": "response_item", "payload": {
                    "type": "message", "id": "message-1", "role": "user",
                    "internal_chat_message_metadata_passthrough": {"turn_id": "turn-1"},
                    "content": [{"type": "input_text", "text": "SYNTHETIC_TEXT"}],
                }}))
            restarted = RolloutCollector(root, database, "COLAB-LOCAL-TEST")
            try:
                self.assertEqual(restarted.poll()["messages"], 1)
                self.assertEqual(restarted.poll()["messages"], 0)
                rollout.write_bytes(b"replacement");
                gap = restarted.poll()
                self.assertEqual(gap["gaps"], 1)
            finally:
                restarted.close()

            with closing(sqlite3.connect(database)) as connection:
                self.assertEqual(connection.execute("SELECT count(*) FROM messages").fetchone()[0], 1)

    def test_merges_same_turn_duplicate_when_sources_arrive_in_separate_polls(self):
        with test_directory() as temporary:
            root = temporary / "sessions"
            root.mkdir()
            database = temporary / "collector.sqlite3"
            rollout = root / "rollout-synthetic.jsonl"
            rollout.write_bytes(record({"type": "session_meta", "payload": {
                "session_id": "thread-synthetic", "originator": "Codex Desktop",
            }}))
            collector = RolloutCollector(root, database, "COLAB-LOCAL-TEST")
            try:
                collector.poll()
                with rollout.open("ab") as stream:
                    stream.write(record({"type": "response_item", "payload": {
                        "type": "message", "id": "response-id", "role": "user",
                        "internal_chat_message_metadata_passthrough": {"turn_id": "turn-1"},
                        "content": [{"type": "input_text", "text": "SYNTHETIC_DUPLICATE"}],
                    }}))
                self.assertEqual(collector.poll()["messages"], 1)
                with rollout.open("ab") as stream:
                    stream.write(record({"type": "event_msg", "payload": {"type": "item_completed",
                        "turn_id": "turn-1", "item": {"type": "UserMessage", "id": "event-id",
                        "content": "SYNTHETIC_DUPLICATE"}}}))
                self.assertEqual(collector.poll()["messages"], 0)
            finally:
                collector.close()

            with closing(sqlite3.connect(database)) as connection:
                row = connection.execute("SELECT count(*), sources_json FROM messages").fetchone()
            self.assertEqual(row[0], 1)
            self.assertEqual(set(json.loads(row[1])), {"response_item", "event_msg.item_completed"})


if __name__ == "__main__":
    unittest.main()
