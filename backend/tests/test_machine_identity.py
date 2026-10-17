import base64
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

os.environ.setdefault("LAB_API_TOKEN", "synthetic-test-token-not-for-real-use-0001")

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils
from fastapi.testclient import TestClient

from app.db import clean_expired, connect, iso, utc_now
from app.main import app, fingerprint
from app.schemas import ArtifactMetadataCreate
from app.settings import get_settings
from assign_machine import main as assign_machine

TOKEN = "synthetic-test-token-not-for-real-use-0001"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
OPERATOR_TOKEN = "synthetic-operator-token-not-for-real-use-0002"
OPERATOR_AUTH = {"Authorization": f"Bearer {OPERATOR_TOKEN}"}
PROJECT = "g-p-6abacc4edb1c81918be5e01d0038640a"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LAB_API_TOKEN", TOKEN)
    monkeypatch.setenv("CAPTURE_API_TOKEN", TOKEN)
    monkeypatch.setenv("OPERATOR_READ_TOKEN", OPERATOR_TOKEN)
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "machine.sqlite3"))
    monkeypatch.setenv("RETENTION_DAYS", "7")
    monkeypatch.setenv("MACHINE_SIGNATURE_REQUIRED", "true")
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()


def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def key_material():
    private = ec.generate_private_key(ec.SECP256R1())
    numbers = private.public_key().public_numbers()
    jwk = {"kty": "EC", "crv": "P-256", "x": b64(numbers.x.to_bytes(32, "big")),
           "y": b64(numbers.y.to_bytes(32, "big"))}
    return private, jwk


def prompt_payload(machine_id, project=PROJECT):
    project_context = ({"url": f"https://chatgpt.com/g/{project}/project", "capture_status": "observed"}
                       if project else {"capture_status": "unknown", "reason": "Fora de projeto"})
    conversation_url = f"https://chatgpt.com/g/{project}/c/synthetic" if project else "https://chatgpt.com/c/synthetic"
    return {"schema_version": "0.1", "client_event_id": str(uuid4()), "platform": "chatgpt_web",
            "device_installation_id": str(machine_id), "account_label": "departamento@example.invalid",
            "project": project_context,
            "conversation": {"url": conversation_url, "capture_status": "observed"},
            "prompt": {"text": "Prompt sintético", "capture_status": "observed"},
            "attachments": [], "adapter_version": "0.5.0-test",
            "observed_at": datetime.now(timezone.utc).isoformat()}


def signed_post(client, path, payload, machine_id, private, nonce=None, body=None, signed_body=None):
    body = body or json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    nonce = nonce or str(uuid4())
    digest = hashlib.sha256(signed_body or body).hexdigest()
    message = f"POST\n{path}\n{timestamp}\n{nonce}\n{digest}".encode("utf-8")
    r, s = utils.decode_dss_signature(private.sign(message, ec.ECDSA(hashes.SHA256())))
    signature = b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
    return client.post(path, content=body, headers={**AUTH, "Content-Type": "application/json",
        "X-Machine-Id": str(machine_id), "X-Machine-Timestamp": timestamp,
        "X-Machine-Nonce": nonce, "X-Machine-Signature": signature})


def signed_get(client, path, machine_id, private):
    timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    nonce = str(uuid4())
    digest = hashlib.sha256(b"").hexdigest()
    message = f"GET\n{path}\n{timestamp}\n{nonce}\n{digest}".encode("utf-8")
    r, s = utils.decode_dss_signature(private.sign(message, ec.ECDSA(hashes.SHA256())))
    signature = b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
    return client.get(path, headers={"X-Machine-Id": str(machine_id), "X-Machine-Timestamp": timestamp,
        "X-Machine-Nonce": nonce, "X-Machine-Signature": signature})


def test_machine_signature_allows_any_project_after_person_assignment(client):
    machine_id = uuid4()
    private, public = key_material()
    route = "/v1/interactions"
    assert client.post(route, json=prompt_payload(machine_id), headers=AUTH).status_code == 401
    enrolled = client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public}, headers=AUTH)
    assert enrolled.status_code == 200
    assert enrolled.json()["installation_id"] == str(machine_id)
    assert signed_post(client, route, prompt_payload(machine_id), machine_id, private).status_code == 403
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ?, employee_id = ?, department_code = ?, assigned_at = ? WHERE installation_id = ?",
                   ("PESSOA-SINTETICA", "func-001", "dep-sintetico", iso(utc_now()), str(machine_id)))
    accepted = signed_post(client, route, prompt_payload(machine_id), machine_id, private)
    assert accepted.status_code == 201
    detail = client.get(f"/v1/interactions/{accepted.json()['interaction_id']}", headers=OPERATOR_AUTH).json()
    assert detail["attributed_person"] == "PESSOA-SINTETICA"
    assert detail["project_id"] == PROJECT
    assert detail["machine_key_fingerprint"] == enrolled.json()["key_fingerprint"]
    other = signed_post(client, route, prompt_payload(machine_id, "g-p-other"), machine_id, private)
    assert other.status_code == 201
    other_detail = client.get(f"/v1/interactions/{other.json()['interaction_id']}", headers=OPERATOR_AUTH).json()
    assert other_detail["project_id"] == "g-p-other"
    outside = signed_post(client, route, prompt_payload(machine_id, None), machine_id, private)
    assert outside.status_code == 201
    outside_detail = client.get(f"/v1/interactions/{outside.json()['interaction_id']}", headers=OPERATOR_AUTH).json()
    assert outside_detail["project_id"] is None
    assert signed_post(client, route, prompt_payload(uuid4()), machine_id, private).status_code == 409

    response_path = f"/v1/interactions/{accepted.json()['interaction_id']}/response"
    answer = {"client_event_id": str(uuid4()), "text": "Resposta sintética", "capture_status": "incomplete",
              "observed_at": datetime.now(timezone.utc).isoformat()}
    assert signed_post(client, response_path, answer, machine_id, private).status_code == 201


def test_stream_capture_stores_metadata_with_assigned_machine_and_rejects_content(client):
    machine_id = uuid4()
    private, public = key_material()
    registered = client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public}, headers=AUTH)
    assert registered.status_code == 200

    payload = {
        "capture_id": str(uuid4()), "device_installation_id": str(machine_id),
        "platform": "chatgpt_web", "path": "/backend-api/f/conversation", "request_id": 19,
        "status_code": 200, "content_type": "text/event-stream", "capture_status": "complete",
        "response_chars": 24, "bytes": 180, "chunks": 4, "frames": 3, "done_markers": 1,
        "protocol_done": True, "reader_done": True, "reader_aborted_after_done": False,
        "truncated": False, "stream_elapsed_ms": 750, "event_types": ["message", "done"],
        "event_shapes": ["type=data"], "event_sequence": ["message", "done"],
        "observed_at": datetime.now(timezone.utc).isoformat(), "adapter_version": "0.3.0",
    }
    route = "/v1/stream-captures"
    assert signed_post(client, route, payload, machine_id, private).status_code == 403
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ?, employee_id = ?, department_code = ?, assigned_at = ? WHERE installation_id = ?",
                   ("PESSOA-SINTETICA", "func-001", "dep-sintetico", iso(utc_now()), str(machine_id)))
    accepted = signed_post(client, route, payload, machine_id, private)
    assert accepted.status_code == 201, accepted.text
    assert accepted.json()["attributed_person"] == "PESSOA-SINTETICA"
    assert signed_post(client, route, payload, machine_id, private).status_code == 200
    with connect(get_settings()) as db:
        row = db.execute("SELECT * FROM stream_captures WHERE capture_id = ?", (payload["capture_id"],)).fetchone()
        columns = {item["name"] for item in db.execute("PRAGMA table_info(stream_captures)")}
    assert row["attributed_person"] == "PESSOA-SINTETICA"
    assert row["response_chars"] == 24
    assert "response_text" not in columns and "prompt_text" not in columns

    content_payload = {**payload, "capture_id": str(uuid4()), "response_text": "synthetic content"}
    assert signed_post(client, route, content_payload, machine_id, private).status_code == 422
    expired = iso(utc_now() - timedelta(days=8))
    with connect(get_settings()) as db:
        db.execute("UPDATE stream_captures SET received_at = ? WHERE capture_id = ?", (expired, payload["capture_id"]))
    clean_expired(get_settings())
    with connect(get_settings()) as db:
        assert db.execute("SELECT count(*) FROM stream_captures WHERE capture_id = ?", (payload["capture_id"],)).fetchone()[0] == 0


def test_artifact_metadata_is_tied_to_machine_assignment(client):
    machine_id = uuid4()
    private, public = key_material()
    client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public}, headers=AUTH)
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ?, employee_id = ?, department_code = ?, assigned_at = ? WHERE installation_id = ?",
                   ("PESSOA-SINTETICA", "func-001", "dep-sintetico", iso(utc_now()), str(machine_id)))
    payload = {"artifact_id": str(uuid4()), "device_installation_id": str(machine_id),
               "platform": "chatgpt_web", "source": "download_headers", "file_name": "synthetic.pdf",
               "mime_type": "application/pdf", "size_bytes": 1024,
               "conversation_context": {"conversation_id": str(uuid4()), "source": "active_route_at_request"},
               "size_source": "content_length",
               "observed_at": datetime.now(timezone.utc).isoformat()}
    accepted = signed_post(client, "/v1/artifact-metadata", payload, machine_id, private)
    assert accepted.status_code == 201
    assert accepted.json()["attributed_person"] == "PESSOA-SINTETICA"
    recent = client.get("/v1/artifact-metadata/recent", headers=OPERATOR_AUTH).json()["items"][0]
    assert recent["mime_type"] == "application/pdf"
    assert recent["size_bytes"] == 1024
    assert recent["conversation_id"] == payload["conversation_context"]["conversation_id"]
    assert recent["conversation_context_source"] == "active_route_at_request"
    assert recent["size_source"] == "content_length"
    assert client.post("/v1/artifact-metadata", json=payload, headers=AUTH).status_code == 401
    json_source = {**payload, "artifact_id": str(uuid4()), "source": "metadata_json"}
    assert signed_post(client, "/v1/artifact-metadata", json_source, machine_id, private).status_code == 422
    with_content = {**payload, "artifact_id": str(uuid4()), "response_text": "synthetic content"}
    assert signed_post(client, "/v1/artifact-metadata", with_content, machine_id, private).status_code == 422

    legacy = {key: value for key, value in payload.items()
              if key not in ("conversation_context", "size_source")}
    legacy["artifact_id"] = str(uuid4())
    legacy_saved = signed_post(client, "/v1/artifact-metadata", legacy, machine_id, private)
    assert legacy_saved.status_code == 201
    old_model_dump = ArtifactMetadataCreate.model_validate(legacy).model_dump(mode="json")
    old_fingerprint_body = {key: value for key, value in old_model_dump.items()
                            if key not in ("conversation_context", "size_source")}
    with connect(get_settings()) as db:
        key_fingerprint = db.execute("SELECT key_fingerprint FROM machines WHERE installation_id = ?",
                                     (str(machine_id),)).fetchone()[0]
        old_fingerprint_body["machine_key_fingerprint"] = key_fingerprint
        current_fingerprint = db.execute("SELECT request_fingerprint FROM artifact_metadata WHERE artifact_id = ?",
                                         (legacy["artifact_id"],)).fetchone()[0]
        assert fingerprint(old_fingerprint_body) == current_fingerprint, json.dumps({
            "old_body": old_fingerprint_body, "expected": fingerprint(old_fingerprint_body),
            "stored": current_fingerprint,
        }, sort_keys=True)
        db.execute("UPDATE artifact_metadata SET request_fingerprint = ? WHERE artifact_id = ?",
                   (fingerprint(old_fingerprint_body), legacy["artifact_id"]))
    replay = signed_post(client, "/v1/artifact-metadata", legacy, machine_id, private)
    assert replay.status_code == 200
    assert replay.json()["duplicate"] is True
    expired = iso(utc_now() - timedelta(days=8))
    with connect(get_settings()) as db:
        db.execute("UPDATE artifact_metadata SET received_at = ? WHERE artifact_id = ?", (expired, payload["artifact_id"]))
    clean_expired(get_settings())
    with connect(get_settings()) as db:
        assert db.execute("SELECT count(*) FROM artifact_metadata WHERE artifact_id = ?", (payload["artifact_id"],)).fetchone()[0] == 0


def test_replay_and_changed_key_are_rejected(client):
    machine_id = uuid4()
    private, public = key_material()
    client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public}, headers=AUTH)
    _, another = key_material()
    assert client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": another},
                       headers=AUTH).status_code == 409
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ?, employee_id = ?, department_code = ? WHERE installation_id = ?",
                   ("PESSOA-SINTETICA", "func-001", "dep-sintetico", str(machine_id)))
    payload = prompt_payload(machine_id)
    nonce = str(uuid4())
    first = signed_post(client, "/v1/interactions", payload, machine_id, private, nonce)
    second = signed_post(client, "/v1/interactions", payload, machine_id, private, nonce)
    assert first.status_code == 201
    assert second.status_code == 409
    changed = json.dumps({**payload, "prompt": {"text": "Texto alterado", "capture_status": "observed"}},
                         ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    original = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    assert signed_post(client, "/v1/interactions", payload, machine_id, private,
                       body=changed, signed_body=original).status_code == 401


def test_operator_assignment_requires_matching_key_fingerprint(client, monkeypatch):
    machine_id = uuid4()
    private, public = key_material()
    registered = client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public},
                             headers=AUTH).json()
    with connect(get_settings()) as db:
        now = iso(utc_now())
        db.execute(
            "INSERT INTO departments(department_code, department_name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)",
            ("dep-sintetico", "Departamento Sintético", now, now),
        )
        db.execute(
            "INSERT INTO employees(employee_id, person_name, department_code, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
            ("func-001", "PESSOA-SINTETICA", "dep-sintetico", now, now),
        )
    args = ["assign_machine.py", str(machine_id), "--employee-id", "func-001", "--fingerprint-prefix"]
    monkeypatch.setattr("sys.argv", [*args, "0000000000000000"])
    with pytest.raises(SystemExit):
        assign_machine()
    assert signed_get(client, f"/v1/machines/{machine_id}", machine_id, private).status_code == 200
    monkeypatch.setattr("sys.argv", [*args, registered["key_fingerprint"][:16]])
    assign_machine()
    assigned = signed_get(client, f"/v1/machines/{machine_id}", machine_id, private).json()
    assert assigned["person_name"] == "PESSOA-SINTETICA"
    assert assigned["employee_id"] == "func-001"
    assert assigned["department_code"] == "dep-sintetico"
    assert assigned["project_id"] is None
