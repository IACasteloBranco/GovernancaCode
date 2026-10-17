import base64
import hashlib
import io
import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils
from fastapi.testclient import TestClient
from google.auth.exceptions import TransportError

from app import security
from app.db import connect, iso, utc_now
from app.main import app
from app.settings import get_settings
from test_machine_identity import key_material, prompt_payload


def bearer(subject):
    return {"Authorization": f"Bearer {subject}"}


def signed(client, method, path, machine_id, private, subject, payload=None):
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode() if payload else b""
    timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    nonce = str(uuid4())
    message = f"{method}\n{path}\n{timestamp}\n{nonce}\n{hashlib.sha256(body).hexdigest()}".encode()
    r, s = utils.decode_dss_signature(private.sign(message, ec.ECDSA(hashes.SHA256())))
    signature = base64.urlsafe_b64encode(r.to_bytes(32, "big") + s.to_bytes(32, "big")).rstrip(b"=").decode()
    headers = {**bearer(subject), "X-Machine-Id": str(machine_id), "X-Machine-Timestamp": timestamp,
               "X-Machine-Nonce": nonce, "X-Machine-Signature": signature}
    if method == "GET":
        return client.get(path, headers=headers)
    return client.post(path, content=body, headers={**headers, "Content-Type": "application/json"})


@pytest.fixture
def lab_client(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "lab")
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "lab.sqlite3"))
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "synthetic-client.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "synthetic-secret")
    monkeypatch.setenv("GOOGLE_EXTENSION_REDIRECT_URI", "https://synthetic.chromiumapp.org/callback")
    monkeypatch.setenv("GOOGLE_OPERATOR_SUB", "operator-sub")
    monkeypatch.setenv("PILOT_DEPARTMENT_CODE", "pilot-dept")
    monkeypatch.setenv("GOOGLE_WORKSPACE_DOMAIN", "example.invalid")
    monkeypatch.setenv("MACHINE_SIGNATURE_REQUIRED", "true")

    def verify(token, request, audience):
        if audience != "synthetic-client.apps.googleusercontent.com" or token in {"bad-audience", "expired"}:
            raise ValueError("bad audience")
        return {"sub": token, "hd": "wrong.invalid" if token == "wrong-domain" else "example.invalid",
                "email": f"{token}@example.invalid", "email_verified": True, "exp": 2000000000,
                "nonce": "synthetic-nonce-123"}

    monkeypatch.setattr(security.id_token, "verify_oauth2_token", verify)
    get_settings.cache_clear()
    with TestClient(app) as client:
        yield client
    get_settings.cache_clear()


def test_code_exchange_checks_redirect_nonce_and_workspace(lab_client, monkeypatch):
    seen = []

    def exchange(request, timeout):
        seen.append((request.full_url, request.data, timeout))
        return io.BytesIO(b'{"id_token":"operator-sub","refresh_token":"never-return"}')

    monkeypatch.setattr("app.main.urllib.request.urlopen", exchange)
    payload = {"code": "synthetic-code", "code_verifier": "v" * 43,
               "nonce": "synthetic-nonce-123", "redirect_uri": "https://synthetic.chromiumapp.org/callback"}
    result = lab_client.post("/v1/auth/google-code", json=payload)
    assert result.status_code == 200
    assert result.json() == {"id_token": "operator-sub", "sub": "operator-sub",
                             "email": "operator-sub@example.invalid", "exp": 2000000000}
    assert seen[0][0] == "https://oauth2.googleapis.com/token"
    assert b"client_secret=synthetic-secret" in seen[0][1]
    assert b"code_verifier=" in seen[0][1]
    assert lab_client.post("/v1/auth/google-code", json={**payload, "redirect_uri": "https://evil.invalid"}).status_code == 403
    assert lab_client.post("/v1/auth/google-code", json={**payload, "nonce": "another-nonce-123"}).status_code == 401
    assert lab_client.get("/v1/artifact-metadata/recent", headers=bearer("wrong-domain")).status_code == 401
    assert lab_client.get("/v1/artifact-metadata/recent", headers=bearer("bad-audience")).status_code == 401
    assert lab_client.get("/v1/artifact-metadata/recent", headers=bearer("expired")).status_code == 401
    assert lab_client.get("/v1/artifact-metadata/recent").status_code == 401


def test_google_key_unavailable_fails_closed(lab_client, monkeypatch):
    def unavailable(token, request, audience):
        raise TransportError("synthetic key service unavailable")

    monkeypatch.setattr(security.id_token, "verify_oauth2_token", unavailable)
    response = lab_client.get("/v1/artifact-metadata/recent", headers=bearer("operator-sub"))
    assert response.status_code == 503
    assert "synthetic key service unavailable" not in response.text


def test_lab_capture_requires_matching_google_account_and_operator_scope(lab_client):
    machine_id = uuid4()
    private, public = key_material()
    enrolled = lab_client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public},
                               headers=bearer("capture-sub"))
    assert enrolled.status_code == 200
    path = f"/v1/machines/{machine_id}"
    assert signed(lab_client, "GET", path, machine_id, private, "capture-sub").status_code == 200
    assert signed(lab_client, "GET", path, machine_id, private, "other-sub").status_code == 403
    assert lab_client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public},
                           headers=bearer("other-sub")).status_code == 403
    payload = prompt_payload(machine_id)
    assert signed(lab_client, "POST", "/v1/interactions", machine_id, private, "capture-sub", payload).status_code == 403
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ?, employee_id = ?, department_code = ?, assigned_at = ? WHERE installation_id = ?",
                   ("SYNTHETIC PERSON", "synthetic-employee", "pilot-dept", iso(utc_now()), str(machine_id)))
    created = signed(lab_client, "POST", "/v1/interactions", machine_id, private, "capture-sub", payload)
    assert created.status_code == 201, created.text
    interaction_id = created.json()["interaction_id"]
    detail_path = f"/v1/interactions/{interaction_id}"
    assert lab_client.get(detail_path, headers=bearer("operator-sub")).status_code == 200
    assert lab_client.get(detail_path, headers=bearer("capture-sub")).status_code == 403
    analytics = lab_client.get("/v1/admin/analytics/summary", headers=bearer("operator-sub"))
    assert analytics.status_code == 200
    assert analytics.json()["department_scope"] == "pilot-dept"
    assert analytics.json()["totals"]["interactions"] == 1
    assert signed(lab_client, "POST", "/v1/interactions", machine_id, private, "other-sub",
                  prompt_payload(machine_id)).status_code == 403
    with connect(get_settings()) as db:
        db.execute("UPDATE interactions SET department_code = ? WHERE interaction_id = ?",
                   ("another-dept", interaction_id))
    assert lab_client.get(detail_path, headers=bearer("operator-sub")).status_code == 404
    assert lab_client.get("/v1/admin/analytics/summary", headers=bearer("operator-sub")).json()["totals"]["interactions"] == 0
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET revoked_at = ? WHERE installation_id = ?", (iso(utc_now()), str(machine_id)))
    assert signed(lab_client, "GET", path, machine_id, private, "capture-sub").status_code == 403
    assert signed(lab_client, "POST", "/v1/interactions", machine_id, private, "capture-sub",
                  prompt_payload(machine_id)).status_code == 403


def test_operator_recent_lists_exclude_other_departments(lab_client):
    machine_id = uuid4()
    private, public = key_material()
    assert lab_client.post("/v1/machines", json={"installation_id": str(machine_id), "public_key": public},
                           headers=bearer("capture-sub")).status_code == 200
    with connect(get_settings()) as db:
        db.execute("UPDATE machines SET person_name = ?, employee_id = ?, department_code = ? WHERE installation_id = ?",
                   ("SYNTHETIC PERSON", "synthetic-employee", "pilot-dept", str(machine_id)))
    stream = {"capture_id": str(uuid4()), "device_installation_id": str(machine_id),
              "platform": "chatgpt_web", "path": "/backend-api/f/conversation", "request_id": 1,
              "status_code": 200, "content_type": "text/event-stream", "capture_status": "complete",
              "response_chars": 4, "bytes": 8, "chunks": 1, "frames": 1, "done_markers": 1,
              "protocol_done": True, "reader_done": True, "reader_aborted_after_done": False,
              "truncated": False, "stream_elapsed_ms": 10, "event_types": ["done"],
              "event_shapes": [], "event_sequence": ["done"], "observed_at": iso(utc_now()),
              "adapter_version": "0.3.0"}
    artifact = {"artifact_id": str(uuid4()), "device_installation_id": str(machine_id),
                "platform": "chatgpt_web", "source": "download_headers", "file_name": "synthetic.txt",
                "mime_type": "text/plain", "size_bytes": 8, "observed_at": iso(utc_now())}
    for payload, path in ((stream, "/v1/stream-captures"), (artifact, "/v1/artifact-metadata")):
        assert signed(lab_client, "POST", path, machine_id, private, "capture-sub", payload).status_code == 201
    with connect(get_settings()) as db:
        db.execute("UPDATE stream_captures SET department_code = 'another-dept' WHERE capture_id = ?",
                   (stream["capture_id"],))
        db.execute("UPDATE artifact_metadata SET department_code = 'another-dept' WHERE artifact_id = ?",
                   (artifact["artifact_id"],))
    stream["capture_id"] = str(uuid4())
    artifact["artifact_id"] = str(uuid4())
    for payload, path in ((stream, "/v1/stream-captures"), (artifact, "/v1/artifact-metadata")):
        assert signed(lab_client, "POST", path, machine_id, private, "capture-sub", payload).status_code == 201
    recent_streams = lab_client.get("/v1/stream-captures/recent", headers=bearer("operator-sub"))
    recent_artifacts = lab_client.get("/v1/artifact-metadata/recent", headers=bearer("operator-sub"))
    assert [item["capture_id"] for item in recent_streams.json()["items"]] == [stream["capture_id"]]
    assert [item["artifact_id"] for item in recent_artifacts.json()["items"]] == [artifact["artifact_id"]]
