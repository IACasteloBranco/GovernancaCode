"""Local-only API for synthetic ChatGPT stream-capture experiments."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

ROOT = Path(__file__).resolve().parent


def load_env() -> dict[str, str]:
    result: dict[str, str] = {}
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                result[key.strip()] = value.strip()
    result.update({key: value for key, value in os.environ.items() if key in {
        "APP_HOST", "APP_PORT", "DATABASE_PATH", "LAB_API_TOKEN", "MAX_RESPONSE_CHARS", "RETENTION_DAYS"
    }})
    return result


CONFIG = load_env()
HOST = CONFIG.get("APP_HOST", "127.0.0.1")
PORT = int(CONFIG.get("APP_PORT", "8765"))
DB_PATH = (ROOT / CONFIG.get("DATABASE_PATH", "./data/stream-captures.sqlite3")).resolve()
TOKEN = CONFIG.get("LAB_API_TOKEN", "")
MAX_TEXT = min(200_000, int(CONFIG.get("MAX_RESPONSE_CHARS", "100000")))
RETENTION_DAYS = max(1, min(30, int(CONFIG.get("RETENTION_DAYS", "7"))))
MAX_BODY = MAX_TEXT * 8 + 100_000
ADAPTER_COMPATIBILITY = re.compile(r"^0\.1\.\d{1,3}$")


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS stream_captures (
      capture_id TEXT PRIMARY KEY,
      payload_hash TEXT NOT NULL,
      platform TEXT NOT NULL,
      path TEXT NOT NULL,
      request_id INTEGER,
      status_code INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      capture_status TEXT NOT NULL,
      prompt_text TEXT,
      response_text TEXT NOT NULL,
      bytes INTEGER,
      chunks INTEGER,
      frames INTEGER,
      done_markers INTEGER,
      protocol_done INTEGER NOT NULL,
      reader_done INTEGER NOT NULL,
      truncated INTEGER NOT NULL,
      stream_elapsed_ms INTEGER,
      event_types_json TEXT NOT NULL,
      event_shapes_json TEXT NOT NULL,
      event_sequence_json TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS artifact_metadata (
      artifact_id TEXT PRIMARY KEY,
      payload_hash TEXT NOT NULL,
      platform TEXT NOT NULL,
      source TEXT NOT NULL,
      file_name TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      file_type TEXT,
      type_source TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    )""")
    columns = {row["name"] for row in db.execute("PRAGMA table_info(stream_captures)")}
    if "capture_status" not in columns:
        db.execute("ALTER TABLE stream_captures ADD COLUMN capture_status TEXT NOT NULL DEFAULT 'complete'")
    if "reader_done" not in columns:
        db.execute("ALTER TABLE stream_captures ADD COLUMN reader_done INTEGER NOT NULL DEFAULT 1")
    if "prompt_text" not in columns:
        db.execute("ALTER TABLE stream_captures ADD COLUMN prompt_text TEXT")
    cutoff = datetime.now(timezone.utc).timestamp() - RETENTION_DAYS * 86400
    db.execute("DELETE FROM stream_captures WHERE julianday(received_at) < julianday(?)", (datetime.fromtimestamp(cutoff, timezone.utc).isoformat(),))
    db.execute("DELETE FROM artifact_metadata WHERE julianday(received_at) < julianday(?)", (datetime.fromtimestamp(cutoff, timezone.utc).isoformat(),))
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def validate(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("JSON deve ser um objeto")
    expected = {"capture_id", "platform", "path", "request_id", "status_code", "content_type", "capture_status", "prompt_text", "response_text",
                "bytes", "chunks", "frames", "done_markers", "protocol_done", "reader_done", "truncated", "stream_elapsed_ms",
                "event_types", "event_shapes", "event_sequence", "observed_at", "adapter_version"}
    if set(payload) not in (expected, expected - {"prompt_text"}):
        raise ValueError("Campos do snapshot inválidos")
    try:
        capture_id = str(UUID(payload["capture_id"]))
        observed = datetime.fromisoformat(payload["observed_at"].replace("Z", "+00:00"))
        if observed.tzinfo is None:
            raise ValueError
        observed = observed.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Identificador ou horário inválido") from None
    if payload["platform"] != "chatgpt_web" or payload["path"] != "/backend-api/f/conversation":
        raise ValueError("Plataforma ou endpoint não permitido")
    if payload["status_code"] != 200 or payload["content_type"] != "text/event-stream":
        raise ValueError("Resposta não corresponde ao stream esperado")
    text = payload["response_text"]
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT:
        raise ValueError("Texto da resposta inválido ou acima do limite")
    prompt_text = payload.get("prompt_text")
    if prompt_text is not None and (not isinstance(prompt_text, str) or not prompt_text.strip() or len(prompt_text) > MAX_TEXT):
        raise ValueError("Texto do prompt inválido ou acima do limite")
    if payload["capture_status"] not in {"complete", "incomplete"}:
        raise ValueError("Status da captura inválido")
    if type(payload["protocol_done"]) is not bool or type(payload["reader_done"]) is not bool or type(payload["truncated"]) is not bool:
        raise ValueError("Indicadores de conclusão inválidos")
    if payload["capture_status"] == "complete" and (
        not payload["protocol_done"] or not payload["reader_done"] or payload["truncated"]
    ):
        raise ValueError("Captura completa precisa de protocolo e leitura concluídos, sem truncamento")
    if not isinstance(payload["adapter_version"], str) or not ADAPTER_COMPATIBILITY.fullmatch(payload["adapter_version"]):
        raise ValueError("Versão do adapter incompatível")
    limits = {"request_id": 2**53 - 1, "status_code": 599, "bytes": MAX_BODY, "chunks": 100_000,
              "frames": 100_000, "done_markers": 1000, "stream_elapsed_ms": 180_000}
    for key, limit in limits.items():
        value = payload[key]
        if value is not None and (type(value) is not int or value < 0 or value > limit):
            raise ValueError(f"Métrica inválida: {key}")
    safe_label = re.compile(r"^[a-zA-Z0-9_.:=-]{1,200}$")
    for key in ("event_types", "event_shapes", "event_sequence"):
        values = payload[key]
        if not isinstance(values, list) or len(values) > 32 or not all(isinstance(x, str) and safe_label.fullmatch(x) for x in values):
            raise ValueError(f"Resumo inválido: {key}")
    clean = {key: payload.get(key) for key in expected if key != "observed_at"}
    clean["capture_id"] = capture_id
    clean["observed_at"] = observed
    clean["payload_hash"] = hashlib.sha256(json.dumps(clean, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return clean


def token_matches(header: str) -> bool:
    return bool(TOKEN) and hmac.compare_digest(header, f"Bearer {TOKEN}")


def validate_artifact_metadata(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("JSON deve ser um objeto")
    expected = {"artifact_id", "platform", "source", "file_name", "mime_type", "size_bytes", "observed_at"}
    if set(payload) != expected:
        raise ValueError("Campos de metadados de artefato inválidos")
    try:
        artifact_id = str(UUID(payload["artifact_id"]))
        observed = datetime.fromisoformat(payload["observed_at"].replace("Z", "+00:00"))
        if observed.tzinfo is None:
            raise ValueError
        observed = observed.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Identificador ou horário inválido") from None
    if payload["platform"] != "chatgpt_web" or not isinstance(payload["source"], str) or payload["source"] not in {"metadata_json", "download_headers"}:
        raise ValueError("Plataforma ou origem de metadados inválida")
    file_name = payload["file_name"]
    if file_name is not None and (
        not isinstance(file_name, str) or not file_name or len(file_name) > 255 or
        file_name in {".", ".."} or "/" in file_name or "\\" in file_name or
        any(ord(char) < 32 or ord(char) == 127 for char in file_name)
    ):
        raise ValueError("Nome de arquivo inválido")
    mime_type = payload["mime_type"]
    if mime_type is not None and (
        not isinstance(mime_type, str) or len(mime_type) > 127 or
        not re.fullmatch(r"[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+", mime_type)
    ):
        raise ValueError("MIME type inválido")
    size_bytes = payload["size_bytes"]
    if size_bytes is not None and (type(size_bytes) is not int or size_bytes < 0 or size_bytes > 2**53 - 1):
        raise ValueError("Tamanho do arquivo inválido")
    if file_name is None and mime_type is None and size_bytes is None:
        raise ValueError("Nenhum metadado útil de arquivo foi informado")

    normalized_mime = mime_type.lower() if mime_type else None
    if normalized_mime and normalized_mime != "application/octet-stream":
        file_type = normalized_mime
        type_source = "mime_type"
    else:
        extension = re.search(r"\.([a-zA-Z0-9]{1,12})$", file_name or "")
        file_type = f".{extension.group(1).lower()}" if extension else None
        type_source = "filename_extension" if extension else "unknown"

    clean = {"artifact_id": artifact_id, "platform": "chatgpt_web", "source": payload["source"],
             "file_name": file_name, "mime_type": normalized_mime, "size_bytes": size_bytes,
             "file_type": file_type, "type_source": type_source, "observed_at": observed}
    clean["payload_hash"] = hashlib.sha256(json.dumps(
        clean, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    ).encode()).hexdigest()
    return clean


def store_artifact_metadata(item: dict) -> tuple[int, dict]:
    received = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        existing = db.execute("SELECT payload_hash FROM artifact_metadata WHERE artifact_id=?", (item["artifact_id"],)).fetchone()
        if existing:
            if existing["payload_hash"] != item["payload_hash"]:
                return 409, {"detail": "artifact_id já usado com conteúdo diferente"}
            return 200, {"artifact_id": item["artifact_id"], "status": "stored", "duplicate": True,
                         "file_type": item["file_type"], "type_source": item["type_source"]}
        db.execute("""INSERT INTO artifact_metadata (
          artifact_id, payload_hash, platform, source, file_name, mime_type, size_bytes,
          file_type, type_source, observed_at, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (item["artifact_id"], item["payload_hash"], item["platform"], item["source"], item["file_name"],
             item["mime_type"], item["size_bytes"], item["file_type"], item["type_source"], item["observed_at"], received))
    return 201, {"artifact_id": item["artifact_id"], "status": "stored", "duplicate": False,
                 "file_type": item["file_type"], "type_source": item["type_source"]}


def store_capture(capture: dict) -> tuple[int, dict]:
    received = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        existing = db.execute("SELECT payload_hash FROM stream_captures WHERE capture_id=?", (capture["capture_id"],)).fetchone()
        if existing:
            if existing["payload_hash"] != capture["payload_hash"]:
                return 409, {"detail": "capture_id já usado com conteúdo diferente"}
            return 200, {"capture_id": capture["capture_id"], "status": "stored", "duplicate": True}
        db.execute("""INSERT INTO stream_captures (
          capture_id, payload_hash, platform, path, request_id, status_code, content_type, capture_status,
          prompt_text, response_text, bytes, chunks, frames, done_markers, protocol_done, reader_done, truncated,
          stream_elapsed_ms, event_types_json, event_shapes_json, event_sequence_json, observed_at, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (capture["capture_id"], capture["payload_hash"], capture["platform"], capture["path"], capture["request_id"],
             capture["status_code"], capture["content_type"], capture["capture_status"], capture["prompt_text"], capture["response_text"], capture["bytes"], capture["chunks"],
             capture["frames"], capture["done_markers"], int(capture["protocol_done"]), int(capture["reader_done"]), int(capture["truncated"]),
             capture["stream_elapsed_ms"], json.dumps(capture["event_types"]), json.dumps(capture["event_shapes"]),
             json.dumps(capture["event_sequence"]), capture["observed_at"], received))
    return 201, {"capture_id": capture["capture_id"], "status": "stored", "duplicate": False}


class Handler(BaseHTTPRequestHandler):
    server_version = "StreamCapturePOC/0.1"

    def respond(self, code: int, value: dict) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        return token_matches(self.headers.get("Authorization", ""))

    def do_GET(self) -> None:  # noqa: N802
        route = urlparse(self.path).path
        if route == "/health":
            self.respond(200, {"status": "ok", "sqlite": True, "schema_version": "stream-capture-0.3"})
            return
        routes = {"/v1/stream-captures/recent", "/v1/artifact-metadata/recent"}
        if route not in routes or not self.authorized():
            self.respond(401 if route in routes else 404, {"detail": "Não autorizado ou rota inexistente"})
            return
        with connect() as db:
            if route == "/v1/stream-captures/recent":
                rows = db.execute("SELECT capture_id, status_code, content_type, capture_status, prompt_text, response_text, bytes, chunks, frames, done_markers, protocol_done, reader_done, truncated, observed_at, received_at FROM stream_captures ORDER BY received_at DESC LIMIT 20").fetchall()
            else:
                rows = db.execute("SELECT artifact_id, source, file_name, mime_type, size_bytes, file_type, type_source, observed_at, received_at FROM artifact_metadata ORDER BY received_at DESC LIMIT 20").fetchall()
        self.respond(200, {"items": [dict(row) for row in rows]})

    def do_POST(self) -> None:  # noqa: N802
        route = urlparse(self.path).path
        if route not in {"/v1/stream-captures", "/v1/artifact-metadata"}:
            self.respond(404, {"detail": "Rota inexistente"})
            return
        if not self.authorized():
            self.respond(401, {"detail": "Token de laboratório inválido"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > (16_384 if route == "/v1/artifact-metadata" else MAX_BODY):
                raise ValueError("Tamanho de requisição inválido")
            payload = json.loads(self.rfile.read(size))
            capture = validate_artifact_metadata(payload) if route == "/v1/artifact-metadata" else validate(payload)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
            self.respond(422, {"detail": str(error)[:200]})
            return
        code, result = store_artifact_metadata(capture) if route == "/v1/artifact-metadata" else store_capture(capture)
        self.respond(code, result)

    def log_message(self, _format: str, *_args: object) -> None:
        return  # Não registrar corpo, token, IP nem URL.


def main() -> None:
    if HOST not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("APP_HOST deve permanecer em loopback nesta POC.")
    if len(TOKEN) < 24:
        raise SystemExit("LAB_API_TOKEN precisa ter pelo menos 24 caracteres; configure backend/.env.")
    with connect() as db:
        db.commit()
    print(f"POC local pronta em http://{HOST}:{PORT} (SQLite: {DB_PATH.name})")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
