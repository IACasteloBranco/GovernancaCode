import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

os.environ.setdefault("LAB_API_TOKEN", "synthetic-test-token-not-for-real-use-0001")

import pytest
from fastapi.testclient import TestClient

from app.db import clean_expired, connect
from app.main import app
from app.settings import get_settings


TOKEN = "synthetic-test-token-not-for-real-use-0001"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "lab.sqlite3"
    monkeypatch.setenv("LAB_API_TOKEN", TOKEN)
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setenv("RETENTION_DAYS", "7")
    monkeypatch.setenv("MAX_PROMPT_CHARS", "100000")
    monkeypatch.setenv("MACHINE_SIGNATURE_REQUIRED", "false")
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()


def interaction_payload(*, client_event_id=None, prompt="Synthetic test prompt"):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "schema_version": "0.1",
        "client_event_id": str(client_event_id or uuid4()),
        "platform": "chatgpt_web",
        "device_installation_id": str(uuid4()),
        "account_label": "lab-user@example.invalid",
        "project": {"name": "Synthetic project", "capture_status": "observed"},
        "conversation": {
            "url": "https://chatgpt.com/c/synthetic-conversation",
            "capture_status": "observed",
        },
        "prompt": {"text": prompt, "capture_status": "observed"},
        "attachments": [],
        "adapter_version": "0.1.0-test",
        "observed_at": now,
    }


def test_health_is_public_and_does_not_expose_internal_configuration(client):
    result = client.get("/health")

    assert result.status_code == 200
    assert result.json() == {"status": "ok", "schema_version": "0.1"}
    assert client.get("/docs").status_code == 404


def test_write_and_query_require_lab_token(client):
    created = client.post("/v1/interactions", json=interaction_payload())

    assert created.status_code == 401
    authorized = client.post("/v1/interactions", json=interaction_payload(), headers=AUTH)
    interaction_id = authorized.json()["interaction_id"]
    queried = client.get(f"/v1/interactions/{interaction_id}")
    assert queried.status_code == 401


def test_interaction_is_persisted_idempotently_and_conflicts_on_changed_payload(client):
    event_id = uuid4()
    payload = interaction_payload(client_event_id=event_id)

    first = client.post("/v1/interactions", json=payload, headers=AUTH)
    repeated = client.post("/v1/interactions", json=payload, headers=AUTH)
    changed = interaction_payload(client_event_id=event_id, prompt="Different synthetic prompt")
    conflict = client.post("/v1/interactions", json=changed, headers=AUTH)

    assert first.status_code == 201
    assert first.json()["status"] == "request_captured"
    assert repeated.status_code == 200
    assert repeated.json()["duplicate"] is True
    assert repeated.json()["interaction_id"] == first.json()["interaction_id"]
    assert conflict.status_code == 409
    detail = client.get(f"/v1/interactions/{first.json()['interaction_id']}", headers=AUTH)
    assert detail.status_code == 200
    assert detail.json()["prompt"]["text"] == "Synthetic test prompt"


def test_response_capture_is_idempotent_and_attached_to_correct_interaction(client):
    request = client.post("/v1/interactions", json=interaction_payload(), headers=AUTH)
    interaction_id = request.json()["interaction_id"]
    response_event_id = str(uuid4())
    response_payload = {
        "client_event_id": response_event_id,
        "text": "Synthetic visible response",
        "capture_status": "complete",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "adapter_version": "0.1.0-test",
    }

    first = client.post(
        f"/v1/interactions/{interaction_id}/response", json=response_payload, headers=AUTH
    )
    repeated = client.post(
        f"/v1/interactions/{interaction_id}/response", json=response_payload, headers=AUTH
    )
    changed = {**response_payload, "text": "Changed synthetic response"}
    conflict = client.post(
        f"/v1/interactions/{interaction_id}/response", json=changed, headers=AUTH
    )
    detail = client.get(f"/v1/interactions/{interaction_id}", headers=AUTH)

    assert first.status_code == 201
    assert repeated.status_code == 200 and repeated.json()["duplicate"] is True
    assert conflict.status_code == 409
    assert detail.json()["status"] == "complete"
    assert len(detail.json()["responses"]) == 1
    assert detail.json()["responses"][0]["text"] == "Synthetic visible response"
    assert [event["event_type"] for event in detail.json()["events"]] == ["request", "response"]


def test_incomplete_response_and_unknown_interaction_are_explicit(client):
    request = client.post("/v1/interactions", json=interaction_payload(), headers=AUTH)
    payload = {
        "client_event_id": str(uuid4()),
        "text": "Partial synthetic response",
        "capture_status": "incomplete",
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }
    response = client.post(
        f"/v1/interactions/{request.json()['interaction_id']}/response", json=payload, headers=AUTH
    )
    missing = client.post(f"/v1/interactions/{uuid4()}/response", json=payload, headers=AUTH)

    assert response.status_code == 201
    assert response.json()["status"] == "incomplete"
    assert missing.status_code == 404


def test_validation_errors_do_not_echo_rejected_prompt(client, monkeypatch):
    monkeypatch.setenv("MAX_PROMPT_CHARS", "5")
    get_settings.cache_clear()
    sensitive_synthetic_text = "Synthetic oversized prompt that must not be echoed"

    result = client.post(
        "/v1/interactions",
        json=interaction_payload(prompt=sensitive_synthetic_text),
        headers=AUTH,
    )

    assert result.status_code == 422
    assert sensitive_synthetic_text not in result.text
    assert "input" not in result.json()["detail"][0]


def test_retention_removes_expired_interaction_and_related_records(client):
    created = client.post("/v1/interactions", json=interaction_payload(), headers=AUTH)
    interaction_id = created.json()["interaction_id"]
    response_payload = {
        "client_event_id": str(uuid4()),
        "text": "Synthetic response to be expired",
        "capture_status": "incomplete",
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }
    client.post(f"/v1/interactions/{interaction_id}/response", json=response_payload, headers=AUTH)
    settings = get_settings()
    old_timestamp = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    with connect(settings) as db:
        db.execute("UPDATE interactions SET received_at = ? WHERE interaction_id = ?", (old_timestamp, interaction_id))

    assert clean_expired(settings) == 1
    with connect(settings) as db:
        assert db.execute("SELECT count(*) FROM interactions").fetchone()[0] == 0
        assert db.execute("SELECT count(*) FROM responses").fetchone()[0] == 0
        assert db.execute("SELECT count(*) FROM capture_events").fetchone()[0] == 0
    assert client.get(f"/v1/interactions/{interaction_id}", headers=AUTH).status_code == 404


def test_record_survives_api_restart(tmp_path, monkeypatch):
    monkeypatch.setenv("LAB_API_TOKEN", TOKEN)
    monkeypatch.setenv("MACHINE_SIGNATURE_REQUIRED", "false")
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "restart.sqlite3"))
    get_settings.cache_clear()
    with TestClient(app) as first_client:
        created = first_client.post("/v1/interactions", json=interaction_payload(), headers=AUTH)
        interaction_id = created.json()["interaction_id"]
    with TestClient(app) as restarted_client:
        detail = restarted_client.get(f"/v1/interactions/{interaction_id}", headers=AUTH)
    get_settings.cache_clear()

    assert detail.status_code == 200
    assert detail.json()["interaction_id"] == interaction_id


@pytest.mark.parametrize("platform", ["chatgpt_web", "claude_web"])
def test_file_metadata_and_material_only_response_roundtrip(client, platform):
    payload = interaction_payload(prompt="")
    payload.update(platform=platform, attachments_capture_status="observed", attachments=[{
        "name": "planilha.csv", "mime_type": "text/csv", "size_bytes": 12,
        "capture_status": "metadata_only", "source": "selection_event",
    }])
    created = client.post("/v1/interactions", json=payload, headers=AUTH)
    assert created.status_code == 201
    identifier = created.json()["interaction_id"]
    response = {
        "client_event_id": str(uuid4()), "text": "", "capture_status": "incomplete",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "generated_materials": {"capture_status": "observed", "items": [{"capture_status": "presence_only"}]},
    }
    route = f"/v1/interactions/{identifier}/response"
    assert client.post(route, json=response, headers=AUTH).status_code == 201
    assert client.post(route, json=response, headers=AUTH).json()["duplicate"]
    detail = client.get(f"/v1/interactions/{identifier}", headers=AUTH).json()
    assert detail["platform"] == platform
    assert detail["attachments_capture_status"] == "observed"
    assert detail["attachments"][0]["size_bytes"] == 12
    assert detail["attachments"][0]["source"] == "selection_event"
    assert detail["responses"][0]["generated_materials"]["items"][0]["capture_status"] == "presence_only"
    response["generated_materials"]["items"][0] = {"capture_status": "metadata_only", "name": "report.pdf"}
    assert client.post(route, json=response, headers=AUTH).status_code == 409


def test_files_reject_binary_fields_and_invalid_observations(client):
    payload = interaction_payload()
    payload["attachments"] = [{"name": "secret.txt", "capture_status": "metadata_only", "content": "not allowed"}]
    assert client.post("/v1/interactions", json=payload, headers=AUTH).status_code == 422
    payload["attachments"] = [{"capture_status": "metadata_only", "size_bytes": -1}]
    assert client.post("/v1/interactions", json=payload, headers=AUTH).status_code == 422
    payload["attachments"] = [{"capture_status": "presence_only"}] * 21
    assert client.post("/v1/interactions", json=payload, headers=AUTH).status_code == 422
    created = client.post("/v1/interactions", json=interaction_payload(), headers=AUTH).json()
    route = f"/v1/interactions/{created['interaction_id']}/response"
    response = {"client_event_id": str(uuid4()), "text": "Text", "capture_status": "complete",
                "observed_at": datetime.now(timezone.utc).isoformat(),
                "generated_materials": {"capture_status": "not_observed", "items": [{"capture_status": "presence_only"}]}}
    assert client.post(route, json=response, headers=AUTH).status_code == 422
    response["generated_materials"] = {"capture_status": "observed", "items": [{"capture_status": "presence_only"}] * 21}
    assert client.post(route, json=response, headers=AUTH).status_code == 422


def test_old_fingerprints_remain_idempotent_after_metadata_upgrade(client):
    from app.main import fingerprint
    from app.schemas import InteractionCreate, ResponseCreate
    import hashlib
    import json

    payload = interaction_payload()
    payload["attachments"] = [{"name": "legacy.txt", "mime_type": None, "capture_status": "metadata_only"}]
    normalized = InteractionCreate(**payload).model_dump(mode="json")
    legacy = dict(normalized)
    legacy.pop("attachments_capture_status")
    legacy.pop("attachments_truncated")
    legacy["attachments"] = [{k: v for k, v in item.items() if k not in ("size_bytes", "source")} for item in legacy["attachments"]]
    old_hash = hashlib.sha256(json.dumps(legacy, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    assert fingerprint(normalized) == old_hash
    response = ResponseCreate(client_event_id=uuid4(), text="old", capture_status="complete", observed_at=datetime.now(timezone.utc)).model_dump(mode="json")
    legacy_response = {k: v for k, v in response.items() if k != "generated_materials"}
    old_response_hash = hashlib.sha256(json.dumps(legacy_response, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    assert fingerprint(response) == old_response_hash


def test_migration_preserves_old_records_with_unknown_file_observation(client):
    from app.db import initialize

    identifier = client.post("/v1/interactions", json=interaction_payload(), headers=AUTH).json()["interaction_id"]
    response = {"client_event_id": str(uuid4()), "text": "Old response", "capture_status": "complete",
                "observed_at": datetime.now(timezone.utc).isoformat()}
    client.post(f"/v1/interactions/{identifier}/response", json=response, headers=AUTH)
    settings = get_settings()
    with connect(settings) as db:
        db.execute("ALTER TABLE interactions DROP COLUMN attachments_capture_status")
        db.execute("ALTER TABLE interactions DROP COLUMN attachments_truncated")
        db.execute("ALTER TABLE responses DROP COLUMN generated_materials_json")
        db.execute("DELETE FROM schema_migrations WHERE version = '0.3'")
    initialize(settings)
    initialize(settings)
    detail = client.get(f"/v1/interactions/{identifier}", headers=AUTH).json()
    assert detail["prompt"]["text"] == "Synthetic test prompt"
    assert detail["attachments_capture_status"] == "unavailable"
    assert detail["responses"][0]["text"] == "Old response"
    assert detail["responses"][0]["generated_materials"]["capture_status"] == "unavailable"
