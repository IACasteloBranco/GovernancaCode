import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .settings import Settings

SCHEMA_VERSION = "0.8"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


@contextmanager
def connect(settings: Settings) -> Iterator[sqlite3.Connection]:
    path: Path = settings.database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10, isolation_level="DEFERRED")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize(settings: Settings) -> None:
    with connect(settings) as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS interactions (
                interaction_id TEXT PRIMARY KEY,
                client_event_id TEXT NOT NULL UNIQUE,
                request_fingerprint TEXT NOT NULL,
                device_installation_id TEXT NOT NULL,
                platform TEXT NOT NULL,
                account_label TEXT,
                project_json TEXT NOT NULL,
                conversation_json TEXT NOT NULL,
                prompt_json TEXT NOT NULL,
                attachments_json TEXT NOT NULL,
                adapter_version TEXT NOT NULL,
                status TEXT NOT NULL,
                observed_at TEXT NOT NULL,
                received_at TEXT NOT NULL,
                source_ip TEXT
            );
            CREATE INDEX IF NOT EXISTS ix_interactions_received_at ON interactions(received_at);
            CREATE TABLE IF NOT EXISTS responses (
                response_id TEXT PRIMARY KEY,
                interaction_id TEXT NOT NULL REFERENCES interactions(interaction_id) ON DELETE CASCADE,
                client_event_id TEXT NOT NULL UNIQUE,
                request_fingerprint TEXT NOT NULL,
                text TEXT NOT NULL,
                capture_status TEXT NOT NULL,
                adapter_version TEXT,
                observed_at TEXT NOT NULL,
                received_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_responses_interaction ON responses(interaction_id, received_at);
            CREATE TABLE IF NOT EXISTS capture_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                interaction_id TEXT REFERENCES interactions(interaction_id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                result TEXT NOT NULL,
                error_code TEXT,
                occurred_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_capture_events_interaction ON capture_events(interaction_id, occurred_at);
            CREATE TABLE IF NOT EXISTS stream_captures (
                capture_id TEXT PRIMARY KEY,
                request_fingerprint TEXT NOT NULL,
                device_installation_id TEXT NOT NULL REFERENCES machines(installation_id),
                attributed_person TEXT NOT NULL,
                machine_key_fingerprint TEXT NOT NULL,
                platform TEXT NOT NULL,
                path TEXT NOT NULL,
                request_id INTEGER NOT NULL,
                status_code INTEGER NOT NULL,
                content_type TEXT NOT NULL,
                capture_status TEXT NOT NULL,
                response_chars INTEGER NOT NULL,
                bytes INTEGER NOT NULL,
                chunks INTEGER NOT NULL,
                frames INTEGER NOT NULL,
                done_markers INTEGER NOT NULL,
                protocol_done INTEGER NOT NULL,
                reader_done INTEGER NOT NULL,
                reader_aborted_after_done INTEGER NOT NULL,
                truncated INTEGER NOT NULL,
                stream_elapsed_ms INTEGER NOT NULL,
                event_types_json TEXT NOT NULL,
                event_shapes_json TEXT NOT NULL,
                event_sequence_json TEXT NOT NULL,
                observed_at TEXT NOT NULL,
                received_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_stream_captures_received_at ON stream_captures(received_at);
            CREATE TABLE IF NOT EXISTS artifact_metadata (
                artifact_id TEXT PRIMARY KEY,
                request_fingerprint TEXT NOT NULL,
                device_installation_id TEXT NOT NULL REFERENCES machines(installation_id),
                attributed_person TEXT NOT NULL,
                machine_key_fingerprint TEXT NOT NULL,
                platform TEXT NOT NULL,
                source TEXT NOT NULL,
                file_name TEXT,
                mime_type TEXT,
                size_bytes INTEGER,
                conversation_id TEXT,
                conversation_context_source TEXT,
                size_source TEXT,
                observed_at TEXT NOT NULL,
                received_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_artifact_metadata_received_at ON artifact_metadata(received_at);
            CREATE TABLE IF NOT EXISTS machines (
                installation_id TEXT PRIMARY KEY,
                public_key_json TEXT NOT NULL,
                key_fingerprint TEXT NOT NULL,
                person_name TEXT,
                project_id TEXT,
                created_at TEXT NOT NULL,
                assigned_at TEXT
            );
            CREATE TABLE IF NOT EXISTS machine_nonces (
                installation_id TEXT NOT NULL REFERENCES machines(installation_id) ON DELETE CASCADE,
                nonce TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                PRIMARY KEY (installation_id, nonce)
            );
            INSERT OR IGNORE INTO schema_migrations(version, applied_at)
            VALUES ('0.1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
            """
        )
        columns = {row["name"] for row in db.execute("PRAGMA table_info(interactions)")}
        if "attributed_person" not in columns:
            db.execute("ALTER TABLE interactions ADD COLUMN attributed_person TEXT")
            db.execute("ALTER TABLE interactions ADD COLUMN project_id TEXT")
            db.execute("ALTER TABLE interactions ADD COLUMN machine_key_fingerprint TEXT")
        db.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.2', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
        if "attachments_capture_status" not in columns:
            db.execute("ALTER TABLE interactions ADD COLUMN attachments_capture_status TEXT NOT NULL DEFAULT 'unavailable'")
            db.execute("ALTER TABLE interactions ADD COLUMN attachments_truncated INTEGER NOT NULL DEFAULT 0")
        response_columns = {row["name"] for row in db.execute("PRAGMA table_info(responses)")}
        if "generated_materials_json" not in response_columns:
            db.execute("ALTER TABLE responses ADD COLUMN generated_materials_json TEXT NOT NULL DEFAULT '{\"capture_status\":\"unavailable\",\"items\":[],\"truncated\":false}'")
        db.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.3', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
        db.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.4', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
        artifact_columns = {row["name"] for row in db.execute("PRAGMA table_info(artifact_metadata)")}
        for name in ("conversation_id", "conversation_context_source", "size_source"):
            if name not in artifact_columns:
                db.execute(f"ALTER TABLE artifact_metadata ADD COLUMN {name} TEXT")
        db.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.5', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
        for table in ("machines", "interactions", "stream_captures", "artifact_metadata"):
            columns = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
            for name in ("employee_id", "department_code"):
                if name not in columns:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN {name} TEXT")
        interaction_columns = {row["name"] for row in db.execute("PRAGMA table_info(interactions)")}
        for name, declaration in (("usage_context", "TEXT NOT NULL DEFAULT 'unknown'"),
                                  ("usage_context_source", "TEXT NOT NULL DEFAULT 'unknown'")):
            if name not in interaction_columns:
                db.execute(f"ALTER TABLE interactions ADD COLUMN {name} {declaration}")
        db.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.6', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
        machine_columns = {row["name"] for row in db.execute("PRAGMA table_info(machines)")}
        for name in ("google_sub", "revoked_at"):
            if name not in machine_columns:
                db.execute(f"ALTER TABLE machines ADD COLUMN {name} TEXT")
        db.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES ('0.7', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS departments (
                department_code TEXT PRIMARY KEY,
                department_name TEXT NOT NULL,
                active INTEGER NOT NULL CHECK (active IN (0, 1)),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS employees (
                employee_id TEXT PRIMARY KEY,
                person_name TEXT NOT NULL,
                department_code TEXT NOT NULL REFERENCES departments(department_code),
                active INTEGER NOT NULL CHECK (active IN (0, 1)),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_employees_department ON employees(department_code, active);
            INSERT OR IGNORE INTO schema_migrations(version, applied_at)
            VALUES ('0.8', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
            """
        )


def json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def clean_expired(settings: Settings) -> int:
    with connect(settings) as db:
        db.execute("DELETE FROM machine_nonces WHERE expires_at <= ?", (iso(utc_now()),))
        cursor = db.execute(
            "DELETE FROM interactions WHERE julianday(received_at) < julianday('now', ?)",
            (f"-{settings.retention_days} days",),
        )
        db.execute(
            "DELETE FROM stream_captures WHERE julianday(received_at) < julianday('now', ?)",
            (f"-{settings.retention_days} days",),
        )
        db.execute(
            "DELETE FROM artifact_metadata WHERE julianday(received_at) < julianday('now', ?)",
            (f"-{settings.retention_days} days",),
        )
        return cursor.rowcount
