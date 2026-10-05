import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

os.environ.setdefault("LAB_API_TOKEN", "synthetic-test-token-not-for-real-use-0001")

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils
from fastapi.testclient import TestClient

from app.db import connect, iso, utc_now
from app.main import app
from app.settings import get_settings
from assign_machine import main as assign_machine

TOKEN = "synthetic-test-token-not-for-real-use-0001"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
PROJECT = "g-p-6abacc4edb1c81918be5e01d0038640a"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LAB_API_TOKEN", TOKEN)
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "machine.sqlite3"))
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


def test_machine_signature_allows_any_project_after_person_assignment(client):
    machine_id = uuid4()
    private, public = key_material()
    route = "/v1/interactions"
    assert client.post(route, json=prompt_payload(machine_id), headers=AUTH).status_code == 401
    enrolled = client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public}, headers=AUTH)
    assert enrolled.status_code == 200
    assert enrolled.json()["person_name"] is None
    assert signed_post(client, route, prompt_payload(machine_id), machine_id, private).status_code == 403
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ?, assigned_at = ? WHERE installation_id = ?",
                   ("EDUARDO", iso(utc_now()), str(machine_id)))
    accepted = signed_post(client, route, prompt_payload(machine_id), machine_id, private)
    assert accepted.status_code == 201
    detail = client.get(f"/v1/interactions/{accepted.json()['interaction_id']}", headers=AUTH).json()
    assert detail["attributed_person"] == "EDUARDO"
    assert detail["project_id"] == PROJECT
    assert detail["machine_key_fingerprint"] == enrolled.json()["key_fingerprint"]
    other = signed_post(client, route, prompt_payload(machine_id, "g-p-other"), machine_id, private)
    assert other.status_code == 201
    other_detail = client.get(f"/v1/interactions/{other.json()['interaction_id']}", headers=AUTH).json()
    assert other_detail["project_id"] == "g-p-other"
    outside = signed_post(client, route, prompt_payload(machine_id, None), machine_id, private)
    assert outside.status_code == 201
    outside_detail = client.get(f"/v1/interactions/{outside.json()['interaction_id']}", headers=AUTH).json()
    assert outside_detail["project_id"] is None
    assert signed_post(client, route, prompt_payload(uuid4()), machine_id, private).status_code == 409

    response_path = f"/v1/interactions/{accepted.json()['interaction_id']}/response"
    answer = {"client_event_id": str(uuid4()), "text": "Resposta sintética", "capture_status": "incomplete",
              "observed_at": datetime.now(timezone.utc).isoformat()}
    assert signed_post(client, response_path, answer, machine_id, private).status_code == 201


def test_replay_and_changed_key_are_rejected(client):
    machine_id = uuid4()
    private, public = key_material()
    client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public}, headers=AUTH)
    _, another = key_material()
    assert client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": another},
                       headers=AUTH).status_code == 409
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ? WHERE installation_id = ?",
                   ("EDUARDO", str(machine_id)))
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
    _, public = key_material()
    registered = client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public},
                             headers=AUTH).json()
    monkeypatch.setattr("sys.argv", ["assign_machine.py", str(machine_id), "EDUARDO",
                                    "--fingerprint-prefix", "0000000000000000"])
    with pytest.raises(SystemExit):
        assign_machine()
    assert client.get(f"/v1/machines/{machine_id}", headers=AUTH).json()["person_name"] is None
    monkeypatch.setattr("sys.argv", ["assign_machine.py", str(machine_id), "EDUARDO",
                                    "--fingerprint-prefix", registered["key_fingerprint"][:16]])
    assign_machine()
    assert client.get(f"/v1/machines/{machine_id}", headers=AUTH).json()["person_name"] == "EDUARDO"
    assert client.get(f"/v1/machines/{machine_id}", headers=AUTH).json()["project_id"] is None
