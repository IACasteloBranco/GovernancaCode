import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import server


class StreamCapturePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.original = {key: getattr(server, key) for key in ("DB_PATH", "TOKEN", "MAX_TEXT", "RETENTION_DAYS")}
        self.temp_dir = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        server.DB_PATH = Path(self.temp_dir.name) / "test.sqlite3"
        server.TOKEN = "test-token-that-is-long-enough-123"
        server.MAX_TEXT = 100_000
        server.RETENTION_DAYS = 7

    def tearDown(self):
        for key, value in self.original.items():
            setattr(server, key, value)
        self.temp_dir.cleanup()

    def payload(self, **changes):
        value = {
            "capture_id": str(uuid4()), "platform": "chatgpt_web", "path": "/backend-api/f/conversation",
            "request_id": 1, "status_code": 200, "content_type": "text/event-stream", "capture_status": "complete",
            "prompt_text": "Prompt sintético: responda OK", "response_text": "Resposta sintética: OK",
            "bytes": 128, "chunks": 2, "frames": 3,
            "done_markers": 1, "protocol_done": True, "reader_done": True, "truncated": False, "stream_elapsed_ms": 800,
            "event_types": ["message=2", "other=1"], "event_shapes": ["keys-type_message"],
            "event_sequence": ["message:other--keys-type_message"],
            "observed_at": datetime.now(timezone.utc).isoformat(), "adapter_version": "0.1.0"
        }
        value.update(changes)
        return value

    def artifact_payload(self, **changes):
        value = {
            "artifact_id": str(uuid4()), "platform": "chatgpt_web", "source": "download_headers",
            "file_name": "teste.csv", "mime_type": "text/csv", "size_bytes": 42,
            "observed_at": datetime.now(timezone.utc).isoformat()
        }
        value.update(changes)
        return value

    def test_complete_snapshot_persists_without_user_or_conversation_identity(self):
        payload = server.validate(self.payload())
        status, result = server.store_capture(payload)
        self.assertEqual(status, 201)
        self.assertFalse(result["duplicate"])
        with server.connect() as db:
            row = db.execute("SELECT * FROM stream_captures").fetchone()
            columns = {item["name"] for item in db.execute("PRAGMA table_info(stream_captures)")}
        self.assertEqual(row["response_text"], "Resposta sintética: OK")
        self.assertTrue({"capture_id", "response_text", "frames", "event_sequence_json"} <= columns)
        self.assertFalse({"user_id", "account", "prompt", "conversation_id", "installation_id"} & columns)

    def test_prompt_and_response_persist_together_in_one_capture(self):
        payload = server.validate(self.payload())
        status, _ = server.store_capture(payload)
        self.assertEqual(status, 201)
        with server.connect() as db:
            rows = db.execute("SELECT prompt_text, response_text FROM stream_captures").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["prompt_text"], "Prompt sintético: responda OK")
        self.assertEqual(rows[0]["response_text"], "Resposta sintética: OK")

    def test_legacy_capture_without_prompt_is_accepted_as_unpaired(self):
        legacy = self.payload()
        legacy.pop("prompt_text")
        status, _ = server.store_capture(server.validate(legacy))
        self.assertEqual(status, 201)
        with server.connect() as db:
            row = db.execute("SELECT prompt_text FROM stream_captures").fetchone()
        self.assertIsNone(row["prompt_text"])

    def test_prompt_text_must_be_nonempty_and_within_limit(self):
        with self.assertRaisesRegex(ValueError, "Texto do prompt"):
            server.validate(self.payload(prompt_text="  "))
        with self.assertRaisesRegex(ValueError, "Texto do prompt"):
            server.validate(self.payload(prompt_text="x" * (server.MAX_TEXT + 1)))

    def test_idempotent_replay_and_conflict(self):
        payload = server.validate(self.payload())
        self.assertEqual(server.store_capture(payload)[0], 201)
        self.assertTrue(server.store_capture(payload)[1]["duplicate"])
        changed = server.validate(self.payload(capture_id=payload["capture_id"], response_text="alterado"))
        self.assertEqual(server.store_capture(changed)[0], 409)

    def test_stores_partial_stream_as_incomplete(self):
        payload = self.payload(capture_status="incomplete", protocol_done=False, reader_done=False,
                               truncated=True, done_markers=0, response_text="Resposta parcial")
        status, _ = server.store_capture(server.validate(payload))
        self.assertEqual(status, 201)
        with server.connect() as db:
            row = db.execute("SELECT capture_status, protocol_done, reader_done, truncated FROM stream_captures").fetchone()
        self.assertEqual((row["capture_status"], row["protocol_done"], row["reader_done"], row["truncated"]),
                         ("incomplete", 0, 0, 1))

    def test_requires_local_lab_token_and_rejects_inconsistent_or_identifying_fields(self):
        self.assertFalse(server.token_matches("Bearer wrong-token"))
        self.assertTrue(server.token_matches(f"Bearer {server.TOKEN}"))
        with self.assertRaises(ValueError):
            server.validate(self.payload(capture_status="complete", reader_done=False))
        partial_after_protocol_marker = server.validate(self.payload(
            capture_status="incomplete", protocol_done=True, reader_done=False
        ))
        self.assertTrue(partial_after_protocol_marker["protocol_done"])
        with self.assertRaises(ValueError):
            server.validate(self.payload(user_id="user-123"))

    def test_accepts_compatible_adapter_patch_versions_and_rejects_new_minor_schema(self):
        self.assertEqual(server.validate(self.payload(adapter_version="0.1.12"))["adapter_version"], "0.1.12")
        self.assertEqual(server.validate(self.payload(adapter_version="0.1.11"))["adapter_version"], "0.1.11")
        self.assertEqual(server.validate(self.payload(adapter_version="0.1.0"))["adapter_version"], "0.1.0")
        with self.assertRaisesRegex(ValueError, "Versão do adapter incompatível"):
            server.validate(self.payload(adapter_version="0.2.0"))

    def test_artifact_metadata_persists_allowlisted_fields_and_declared_type(self):
        item = server.validate_artifact_metadata(self.artifact_payload())
        status, result = server.store_artifact_metadata(item)
        self.assertEqual(status, 201)
        self.assertEqual(result["file_type"], "text/csv")
        self.assertEqual(result["type_source"], "mime_type")
        with server.connect() as db:
            row = db.execute("SELECT * FROM artifact_metadata").fetchone()
            columns = {value["name"] for value in db.execute("PRAGMA table_info(artifact_metadata)")}
        self.assertEqual(row["file_name"], "teste.csv")
        self.assertEqual(row["mime_type"], "text/csv")
        self.assertEqual(row["size_bytes"], 42)
        self.assertEqual(row["type_source"], "mime_type")
        self.assertFalse({"download_url", "conversation_id", "file_id", "account", "user_id"} & columns)

    def test_artifact_type_falls_back_to_extension_when_mime_is_missing_or_generic(self):
        inferred = server.validate_artifact_metadata(self.artifact_payload(mime_type=None, size_bytes=None))
        self.assertEqual((inferred["file_type"], inferred["type_source"]), (".csv", "filename_extension"))
        generic = server.validate_artifact_metadata(self.artifact_payload(mime_type="application/octet-stream"))
        self.assertEqual((generic["file_type"], generic["type_source"]), (".csv", "filename_extension"))

    def test_artifact_metadata_is_idempotent_and_rejects_urls_or_path_names(self):
        item = server.validate_artifact_metadata(self.artifact_payload())
        self.assertEqual(server.store_artifact_metadata(item)[0], 201)
        self.assertTrue(server.store_artifact_metadata(item)[1]["duplicate"])
        changed = server.validate_artifact_metadata(self.artifact_payload(
            artifact_id=item["artifact_id"], file_name="outro.csv"
        ))
        self.assertEqual(server.store_artifact_metadata(changed)[0], 409)
        with self.assertRaises(ValueError):
            server.validate_artifact_metadata(self.artifact_payload(download_url="https://example.test/signed"))
        with self.assertRaises(ValueError):
            server.validate_artifact_metadata(self.artifact_payload(file_name="../teste.csv"))
        with self.assertRaises(ValueError):
            server.validate_artifact_metadata(self.artifact_payload(file_name=None, mime_type=None, size_bytes=None))


if __name__ == "__main__":
    unittest.main()
