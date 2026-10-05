import asyncio
import hashlib
import json
import logging
from contextlib import asynccontextmanager, suppress
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .db import clean_expired, connect, initialize, iso, json_dump, utc_now
from .schemas import (
    HealthResponse,
    InteractionAccepted,
    InteractionCreate,
    InteractionDetail,
    ResponseAccepted,
    ResponseCreate,
)
from .security import require_lab_token
from .machine_identity import Machine, enroll_machine, project_id_from_url, require_machine_signature
from .settings import Settings, get_settings

logger = logging.getLogger("backend")


def fingerprint(payload: dict) -> str:
    # Preserve idempotency for events written before the metadata migration.
    payload = dict(payload)
    if payload.get("attachments_capture_status") == "unavailable":
        payload.pop("attachments_capture_status")
    if payload.get("attachments_truncated") is False:
        payload.pop("attachments_truncated")
    if payload.get("generated_materials") == {"capture_status": "unavailable", "items": [], "truncated": False}:
        payload.pop("generated_materials")
    if "attachments" in payload:
        payload["attachments"] = [{key: value for key, value in item.items()
                                   if key not in ("size_bytes", "source") or value is not None} for item in payload["attachments"]]
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.validate_lab_configuration()
    initialize(settings)
    clean_expired(settings)

    async def retention_loop() -> None:
        while True:
            await asyncio.sleep(24 * 60 * 60)
            try:
                deleted = clean_expired(settings)
                logger.info("retention_cleanup completed deleted_count=%s", deleted)
            except Exception:
                logger.exception("retention_cleanup failed")

    cleanup_task = asyncio.create_task(retention_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task


app = FastAPI(
    title="AI Governance Lab Capture API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Pydantic errors can contain the rejected input; omit it so prompts never echo in API errors.
    errors = [
        {"loc": error.get("loc", []), "type": error.get("type", "value_error"), "msg": error.get("msg", "Invalid value")}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})

settings = get_settings()
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", schema_version="0.1")


class MachineEnrollment(BaseModel):
    installation_id: UUID
    public_key: dict


@app.post("/v1/machines", dependencies=[Depends(require_lab_token)])
def register_machine(payload: MachineEnrollment, settings: Settings = Depends(get_settings)) -> dict:
    return enroll_machine(payload.installation_id, payload.public_key, settings)


@app.get("/v1/machines/{installation_id}", dependencies=[Depends(require_lab_token)])
def get_machine(installation_id: UUID, settings: Settings = Depends(get_settings)) -> dict:
    with connect(settings) as db:
        row = db.execute("SELECT installation_id, key_fingerprint, person_name, project_id FROM machines WHERE installation_id = ?",
                         (str(installation_id),)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Machine not enrolled")
    return dict(row)


@app.post(
    "/v1/interactions",
    response_model=InteractionAccepted,
    status_code=status.HTTP_201_CREATED,
)
def create_interaction(
    payload: InteractionCreate,
    request: Request,
    response: Response,
    machine: Machine | None = Depends(require_machine_signature),
    settings: Settings = Depends(get_settings),
) -> InteractionAccepted:
    project_id = project_id_from_url(payload.project.url)
    if machine and str(payload.device_installation_id) != machine.installation_id:
        raise HTTPException(status_code=409, detail="Machine and installation do not match")
    body = payload.model_dump(mode="json")
    if machine:
        body["machine_key_fingerprint"] = machine.fingerprint
    request_fingerprint = fingerprint(body)
    received_at = utc_now()
    interaction_id = str(uuid4())
    source_ip = request.client.host if request.client else None
    with connect(settings) as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute(
            "SELECT interaction_id, request_fingerprint, status, received_at FROM interactions WHERE client_event_id = ?",
            (str(payload.client_event_id),),
        ).fetchone()
        if existing:
            if existing["request_fingerprint"] != request_fingerprint:
                raise HTTPException(status_code=409, detail="client_event_id was already used with different content")
            response.status_code = status.HTTP_200_OK
            return InteractionAccepted(
                interaction_id=existing["interaction_id"],
                status=existing["status"],
                received_at=datetime.fromisoformat(existing["received_at"]),
                duplicate=True,
            )
        db.execute(
            """INSERT INTO interactions (
                interaction_id, client_event_id, request_fingerprint, device_installation_id,
                platform, account_label, project_json, conversation_json, prompt_json,
                attachments_json, adapter_version, status, observed_at, received_at, source_ip,
                attributed_person, project_id, machine_key_fingerprint,
                attachments_capture_status, attachments_truncated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                interaction_id,
                str(payload.client_event_id),
                request_fingerprint,
                str(payload.device_installation_id),
                payload.platform,
                payload.account_label,
                json_dump(payload.project.model_dump(mode="json")),
                json_dump(payload.conversation.model_dump(mode="json")),
                json_dump(payload.prompt.model_dump(mode="json")),
                json_dump([item.model_dump(mode="json") for item in payload.attachments]),
                payload.adapter_version,
                "request_captured",
                iso(payload.observed_at),
                iso(received_at),
                source_ip,
                machine.person_name if machine else None,
                project_id,
                machine.fingerprint if machine else None,
                payload.attachments_capture_status,
                payload.attachments_truncated,
            ),
        )
        db.execute(
            "INSERT INTO capture_events(interaction_id, event_type, result, occurred_at) VALUES (?, ?, ?, ?)",
            (interaction_id, "request", "captured", iso(received_at)),
        )
    return InteractionAccepted(
        interaction_id=interaction_id,
        status="request_captured",
        received_at=received_at,
    )


@app.post(
    "/v1/interactions/{interaction_id}/response",
    response_model=ResponseAccepted,
    status_code=status.HTTP_201_CREATED,
)
def create_response(
    interaction_id: UUID,
    payload: ResponseCreate,
    response: Response,
    machine: Machine | None = Depends(require_machine_signature),
    settings: Settings = Depends(get_settings),
) -> ResponseAccepted:
    received_at = utc_now()
    body = payload.model_dump(mode="json")
    request_fingerprint = fingerprint(body)
    with connect(settings) as db:
        db.execute("BEGIN IMMEDIATE")
        interaction = db.execute(
            "SELECT interaction_id, device_installation_id, machine_key_fingerprint FROM interactions WHERE interaction_id = ?", (str(interaction_id),)
        ).fetchone()
        if interaction is None:
            raise HTTPException(status_code=404, detail="interaction not found")
        if machine and (interaction["device_installation_id"] != machine.installation_id or
                        interaction["machine_key_fingerprint"] != machine.fingerprint):
            raise HTTPException(status_code=404, detail="interaction not found")
        existing = db.execute(
            "SELECT interaction_id, request_fingerprint, capture_status, received_at FROM responses WHERE client_event_id = ?",
            (str(payload.client_event_id),),
        ).fetchone()
        if existing:
            if existing["interaction_id"] != str(interaction_id) or existing["request_fingerprint"] != request_fingerprint:
                raise HTTPException(status_code=409, detail="client_event_id was already used with different content")
            response.status_code = status.HTTP_200_OK
            return ResponseAccepted(
                interaction_id=interaction_id,
                status=existing["capture_status"],
                received_at=datetime.fromisoformat(existing["received_at"]),
                duplicate=True,
            )
        db.execute(
            """INSERT INTO responses (
                response_id, interaction_id, client_event_id, request_fingerprint,
                text, capture_status, adapter_version, observed_at, received_at, generated_materials_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                str(uuid4()),
                str(interaction_id),
                str(payload.client_event_id),
                request_fingerprint,
                payload.text,
                payload.capture_status,
                payload.adapter_version,
                iso(payload.observed_at),
                iso(received_at),
                json_dump(payload.generated_materials.model_dump(mode="json")),
            ),
        )
        db.execute(
            "UPDATE interactions SET status = ? WHERE interaction_id = ?",
            (payload.capture_status, str(interaction_id)),
        )
        db.execute(
            "INSERT INTO capture_events(interaction_id, event_type, result, occurred_at) VALUES (?, ?, ?, ?)",
            (str(interaction_id), "response", payload.capture_status, iso(received_at)),
        )
    return ResponseAccepted(interaction_id=interaction_id, status=payload.capture_status, received_at=received_at)


@app.get(
    "/v1/interactions/{interaction_id}",
    response_model=InteractionDetail,
    dependencies=[Depends(require_lab_token)],
)
def get_interaction(interaction_id: UUID, settings: Settings = Depends(get_settings)) -> InteractionDetail:
    with connect(settings) as db:
        row = db.execute("SELECT * FROM interactions WHERE interaction_id = ?", (str(interaction_id),)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="interaction not found")
        responses = db.execute(
            "SELECT client_event_id, text, capture_status, adapter_version, observed_at, received_at, generated_materials_json FROM responses WHERE interaction_id = ? ORDER BY received_at",
            (str(interaction_id),),
        ).fetchall()
        events = db.execute(
            "SELECT event_type, result, error_code, occurred_at FROM capture_events WHERE interaction_id = ? ORDER BY occurred_at",
            (str(interaction_id),),
        ).fetchall()
    return InteractionDetail(
        interaction_id=row["interaction_id"],
        client_event_id=row["client_event_id"],
        device_installation_id=row["device_installation_id"],
        platform=row["platform"],
        account_label=row["account_label"],
        attributed_person=row["attributed_person"],
        project_id=row["project_id"],
        machine_key_fingerprint=row["machine_key_fingerprint"],
        project=json.loads(row["project_json"]),
        conversation=json.loads(row["conversation_json"]),
        prompt=json.loads(row["prompt_json"]),
        attachments=json.loads(row["attachments_json"]),
        attachments_capture_status=row["attachments_capture_status"],
        attachments_truncated=bool(row["attachments_truncated"]),
        adapter_version=row["adapter_version"],
        status=row["status"],
        observed_at=datetime.fromisoformat(row["observed_at"]),
        received_at=datetime.fromisoformat(row["received_at"]),
        source_ip=row["source_ip"],
        responses=[{**{key: item[key] for key in item.keys() if key != "generated_materials_json"},
                    "generated_materials": json.loads(item["generated_materials_json"])} for item in responses],
        events=[
            {
                "event_type": item["event_type"],
                "result": item["result"],
                "error_code": item["error_code"],
                "occurred_at": datetime.fromisoformat(item["occurred_at"]),
            }
            for item in events
        ],
    )
