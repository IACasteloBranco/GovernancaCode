import asyncio
import base64
import hashlib
import json
import logging
import secrets
import urllib.error
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field

from .analytics import router as analytics_router
from .db import SCHEMA_VERSION, begin_write, clean_expired, connect, initialize, iso, json_dump, record_privacy_audit, utc_now
from .schemas import (
    ArtifactMetadataCreate,
    HealthResponse,
    InteractionAccepted,
    InteractionCreate,
    InteractionDetail,
    ResponseAccepted,
    ResponseCreate,
    StreamCaptureAccepted,
    StreamCaptureCreate,
)
from .security import (dashboard_operator_department, require_analytics_operator, require_capture_token, require_dashboard_session,
                       require_content_viewer, require_operator_token, verify_google_token)
from .machine_identity import (Machine, enroll_machine, project_id_from_url,
                               require_machine_proof, require_machine_signature)
from .settings import Settings, get_settings

logger = logging.getLogger("backend")
ANALYTICS_DIR = Path(__file__).resolve().parents[2] / "analytics"
if not ANALYTICS_DIR.is_dir():
    ANALYTICS_DIR = Path(__file__).resolve().parents[1] / "analytics"


def _dashboard_cookie_secure(request: Request, settings: Settings) -> bool:
    return settings.app_env.lower() == "lab" or request.url.scheme == "https"


def fingerprint(payload: dict) -> str:
    payload = dict(payload)
    if payload.get("usage_context") == "unknown":
        payload.pop("usage_context")
    if payload.get("usage_context_source") == "unknown":
        payload.pop("usage_context_source")
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
app.include_router(analytics_router)


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
        allow_headers=["Authorization", "Content-Type", "X-Machine-Id", "X-Machine-Timestamp",
                       "X-Machine-Nonce", "X-Machine-Signature"],
    )
@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", schema_version=SCHEMA_VERSION)


class GoogleCodeExchange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=4096)
    code_verifier: str = Field(pattern=r"^[A-Za-z0-9._~-]{43,128}$")
    nonce: str = Field(min_length=16, max_length=256)
    redirect_uri: str = Field(min_length=1, max_length=2048)


_DASHBOARD_OAUTH_COOKIE_PATH = "/v1/auth/dashboard"
_DASHBOARD_OAUTH_COOKIES = ("analytics_oauth_state", "analytics_oauth_nonce", "analytics_oauth_verifier")


def _exchange_google_code(code: str, code_verifier: str, redirect_uri: str, settings: Settings) -> str:
    data = urllib.parse.urlencode({
        "code": code,
        "code_verifier": code_verifier,
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret.get_secret_value(),
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode("ascii")
    request = urllib.request.Request("https://oauth2.googleapis.com/token", data=data,
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(request, timeout=10) as result:
            token = json.load(result).get("id_token")
    except (urllib.error.URLError, ValueError, KeyError, AttributeError) as error:
        raise HTTPException(status_code=401, detail="Google code exchange failed") from error
    if not isinstance(token, str) or not token:
        raise HTTPException(status_code=401, detail="Google code exchange failed")
    return token


@app.post("/v1/auth/google-code")
def exchange_google_code(payload: GoogleCodeExchange, settings: Settings = Depends(get_settings)) -> dict:
    if settings.app_env.lower() != "lab" or payload.redirect_uri != settings.google_extension_redirect_uri:
        raise HTTPException(status_code=403, detail="Google login is not configured for this redirect")
    token = _exchange_google_code(payload.code, payload.code_verifier,
                                  settings.google_extension_redirect_uri, settings)
    claims = verify_google_token(token, settings, payload.nonce)
    return {"id_token": token, "sub": claims["sub"], "email": claims["email"], "exp": claims["exp"]}


@app.get("/v1/auth/dashboard/start")
def start_dashboard_login(settings: Settings = Depends(get_settings)) -> RedirectResponse:
    redirect_uri = settings.google_analytics_redirect_uri
    if (settings.app_env.lower() != "lab" or not settings.google_oauth_client_id or
            not settings.google_oauth_client_secret or not redirect_uri or
            not settings.content_viewer_subs or not settings.pilot_department_code):
        raise HTTPException(status_code=503, detail="Dashboard login is not configured")

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    authorization_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "hd": settings.google_workspace_domain,
    })
    response = RedirectResponse(authorization_url, status_code=302)
    response.headers["Cache-Control"] = "no-store"
    secure = settings.app_env.lower() == "lab"
    for name, value in zip(_DASHBOARD_OAUTH_COOKIES, (state, nonce, verifier)):
        response.set_cookie(name, value, max_age=600, path=_DASHBOARD_OAUTH_COOKIE_PATH,
                            secure=secure, httponly=True, samesite="lax")
    return response


@app.get("/v1/auth/dashboard/callback")
def finish_dashboard_login(code: str, state: str, request: Request,
                           settings: Settings = Depends(get_settings)) -> RedirectResponse:
    redirect_uri = settings.google_analytics_redirect_uri
    cookie_state = request.cookies.get("analytics_oauth_state", "")
    nonce = request.cookies.get("analytics_oauth_nonce", "")
    verifier = request.cookies.get("analytics_oauth_verifier", "")
    if (settings.app_env.lower() != "lab" or not redirect_uri or not code or len(code) > 4096 or
            not state or len(state) > 256 or not cookie_state or not secrets.compare_digest(state, cookie_state) or
            not nonce or not verifier):
        raise HTTPException(status_code=400, detail="Invalid dashboard OAuth callback")

    token = _exchange_google_code(code, verifier, redirect_uri, settings)
    claims = verify_google_token(token, settings, nonce)
    dashboard_operator_department(claims, settings)

    response = RedirectResponse("/analytics/", status_code=303)
    response.headers["Cache-Control"] = "no-store"
    secure = _dashboard_cookie_secure(request, settings)
    response.set_cookie("analytics_session", token,
                        max_age=max(1, claims["exp"] - int(datetime.now(timezone.utc).timestamp())),
                        path="/v1", secure=secure, httponly=True, samesite="lax")
    for name in _DASHBOARD_OAUTH_COOKIES:
        response.delete_cookie(name, path=_DASHBOARD_OAUTH_COOKIE_PATH, secure=secure,
                               httponly=True, samesite="lax")
    return response


@app.get("/analytics/", include_in_schema=False)
def analytics_dashboard() -> FileResponse:
    return FileResponse(ANALYTICS_DIR / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/v1/auth/dashboard/session")
def dashboard_session(response: Response, claims: dict = Depends(require_dashboard_session)) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return {"authenticated": True, "email": claims["email"], "expires_at": claims["exp"]}


@app.post("/v1/auth/dashboard/logout")
def dashboard_logout(request: Request, settings: Settings = Depends(get_settings)) -> Response:
    response = Response(status_code=204)
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie("analytics_session", path="/v1",
                           secure=_dashboard_cookie_secure(request, settings), httponly=True, samesite="lax")
    return response


@app.get("/v1/stream-captures/recent")
def recent_stream_captures(department_code: str | None = Depends(require_operator_token),
                           settings: Settings = Depends(get_settings)) -> dict:
    with connect(settings) as db:
        rows = db.execute(
            """SELECT capture_id, device_installation_id, attributed_person, employee_id, department_code, machine_key_fingerprint,
                      platform, path, request_id, status_code, content_type, capture_status,
                      response_chars, bytes, chunks, frames, done_markers, protocol_done,
                      reader_done, reader_aborted_after_done, truncated, stream_elapsed_ms,
                      event_types_json, event_shapes_json, event_sequence_json, observed_at, received_at
               FROM stream_captures WHERE (CAST(? AS TEXT) IS NULL OR department_code = ?)
               ORDER BY received_at DESC LIMIT 20""", (department_code, department_code)
        ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["event_types"] = json.loads(item.pop("event_types_json"))
        item["event_shapes"] = json.loads(item.pop("event_shapes_json"))
        item["event_sequence"] = json.loads(item.pop("event_sequence_json"))
        items.append(item)
    return {"items": items}


@app.get("/v1/artifact-metadata/recent")
def recent_artifact_metadata(department_code: str | None = Depends(require_operator_token),
                             settings: Settings = Depends(get_settings)) -> dict:
    with connect(settings) as db:
        rows = db.execute(
            """SELECT artifact_id, device_installation_id, attributed_person, employee_id, department_code, machine_key_fingerprint,
                      platform, source, file_name, mime_type, size_bytes, conversation_id,
                      conversation_context_source, size_source, observed_at, received_at
               FROM artifact_metadata WHERE (CAST(? AS TEXT) IS NULL OR department_code = ?)
               ORDER BY received_at DESC LIMIT 20""", (department_code, department_code)
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


class MachineEnrollment(BaseModel):
    installation_id: UUID
    public_key: dict


class MachineAssignmentRequest(BaseModel):
    employee_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._@:-]+$")


@app.post("/v1/machines")
def register_machine(payload: MachineEnrollment, google_sub: str | None = Depends(require_capture_token),
                     settings: Settings = Depends(get_settings)) -> dict:
    return enroll_machine(payload.installation_id, payload.public_key, settings, google_sub)


@app.post("/v1/machines/{installation_id}/assignment-request")
def request_machine_assignment(installation_id: UUID, payload: MachineAssignmentRequest,
                               machine: Machine | None = Depends(require_machine_proof),
                               settings: Settings = Depends(get_settings)) -> dict:
    if machine is None or machine.installation_id != str(installation_id):
        raise HTTPException(status_code=403, detail="Installation proof required")
    with connect(settings) as db:
        begin_write(db, "machines")
        employee = db.execute(
            """SELECT e.person_name, e.department_code FROM employees e
               JOIN departments d USING (department_code)
               WHERE e.employee_id = ? AND e.active = 1 AND d.active = 1""",
            (payload.employee_id,),
        ).fetchone()
        if employee is None:
            raise HTTPException(status_code=404, detail="Active employee code not found")
        row = db.execute("SELECT employee_id, revoked_at, requested_employee_id, requested_at FROM machines WHERE installation_id = ?",
                         (str(installation_id),)).fetchone()
        if row is None or row["revoked_at"]:
            raise HTTPException(status_code=403, detail="Installation is unavailable")
        if row["employee_id"]:
            raise HTTPException(status_code=409, detail="Installation is already assigned")
        if row["requested_employee_id"]:
            if row["requested_employee_id"] != payload.employee_id:
                raise HTTPException(status_code=409, detail="Another assignment request is already pending")
            return {"status": "pending", "employee_id": payload.employee_id,
                    "person_name": employee["person_name"], "department_code": employee["department_code"],
                    "requested_at": row["requested_at"]}
        requested_at = iso(utc_now())
        db.execute("UPDATE machines SET requested_employee_id = ?, requested_at = ? WHERE installation_id = ?",
                   (payload.employee_id, requested_at, str(installation_id)))
    return {"status": "pending", "employee_id": payload.employee_id,
            "person_name": employee["person_name"], "department_code": employee["department_code"],
            "requested_at": requested_at}


@app.get("/v1/machines/{installation_id}")
def get_machine(installation_id: UUID, machine: Machine | None = Depends(require_machine_proof),
                settings: Settings = Depends(get_settings)) -> dict:
    if machine is None or machine.installation_id != str(installation_id):
        raise HTTPException(status_code=403, detail="Installation proof required")
    with connect(settings) as db:
        row = db.execute("SELECT installation_id, key_fingerprint, person_name, project_id, employee_id, department_code, requested_employee_id, requested_at FROM machines WHERE installation_id = ?",
                         (str(installation_id),)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Machine not enrolled")
    return dict(row)


@app.get("/v1/admin/machines/assignment-requests")
def list_machine_assignment_requests(
    department_code: str | None = Depends(require_analytics_operator),
    settings: Settings = Depends(get_settings),
) -> dict:
    with connect(settings) as db:
        rows = db.execute(
            """SELECT m.installation_id, m.key_fingerprint, m.requested_employee_id,
                      m.requested_at, m.employee_id AS assigned_employee_id, m.revoked_at,
                      m.google_sub, e.person_name, e.department_code, e.active AS employee_active,
                      d.department_name, d.active AS department_active
               FROM machines m
               LEFT JOIN employees e ON e.employee_id = m.requested_employee_id
               LEFT JOIN departments d ON d.department_code = e.department_code
               WHERE m.requested_employee_id IS NOT NULL
                 AND (CAST(? AS TEXT) IS NULL OR e.department_code = ?)
               ORDER BY m.requested_at, m.installation_id""",
            (department_code, department_code),
        ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["can_approve"] = bool(
            item["person_name"] and item["department_code"] and item["employee_active"] == 1 and
            item["department_active"] == 1 and not item["assigned_employee_id"] and not item["revoked_at"] and
            (settings.app_env.lower() != "lab" or (item["google_sub"] and
             settings.allows_pilot_department(item["department_code"])))
        )
        item.pop("google_sub")
        items.append(item)
    return {"items": items}


@app.post("/v1/admin/machines/{installation_id}/assignment-request/approve")
def approve_machine_assignment_request(
    installation_id: UUID,
    department_code: str | None = Depends(require_analytics_operator),
    settings: Settings = Depends(get_settings),
) -> dict:
    with connect(settings) as db:
        begin_write(db, "machines")
        row = db.execute(
            """SELECT m.requested_employee_id, m.requested_at, m.key_fingerprint,
                      m.employee_id AS assigned_employee_id, m.revoked_at, m.google_sub,
                      e.person_name, e.department_code, e.active AS employee_active, d.active AS department_active
               FROM machines m
               LEFT JOIN employees e ON e.employee_id = m.requested_employee_id
               LEFT JOIN departments d ON d.department_code = e.department_code
               WHERE m.installation_id = ?""",
            (str(installation_id),),
        ).fetchone()
        if row is None or not row["requested_employee_id"]:
            raise HTTPException(status_code=404, detail="Pending assignment request not found")
        if department_code and row["department_code"] != department_code:
            raise HTTPException(status_code=404, detail="Pending assignment request not found")
        if (row["assigned_employee_id"] or row["revoked_at"] or not row["person_name"] or
                row["employee_active"] != 1 or row["department_active"] != 1):
            raise HTTPException(status_code=409, detail="Assignment request is no longer eligible")
        if settings.app_env.lower() == "lab" and (
                not row["google_sub"] or not settings.allows_pilot_department(row["department_code"])):
            raise HTTPException(status_code=403, detail="Installation is outside the authorized pilot")
        cursor = db.execute(
            """UPDATE machines
               SET person_name = ?, employee_id = requested_employee_id, department_code = ?, assigned_at = ?,
                   requested_employee_id = NULL, requested_at = NULL
               WHERE installation_id = ? AND requested_employee_id = ? AND requested_at = ?
                 AND employee_id IS NULL AND revoked_at IS NULL""",
            (row["person_name"], row["department_code"], iso(utc_now()), str(installation_id),
             row["requested_employee_id"], row["requested_at"]),
        )
        if cursor.rowcount != 1:
            raise HTTPException(status_code=409, detail="Assignment request changed; refresh and try again")
    return {"status": "approved", "installation_id": str(installation_id),
            "employee_id": row["requested_employee_id"], "person_name": row["person_name"]}


@app.post("/v1/admin/machines/{installation_id}/assignment-request/reject")
def reject_machine_assignment_request(
    installation_id: UUID,
    department_code: str | None = Depends(require_analytics_operator),
    settings: Settings = Depends(get_settings),
) -> dict:
    with connect(settings) as db:
        begin_write(db, "machines")
        row = db.execute(
            """SELECT m.requested_employee_id, m.requested_at, e.department_code
               FROM machines m LEFT JOIN employees e ON e.employee_id = m.requested_employee_id
               WHERE m.installation_id = ?""",
            (str(installation_id),),
        ).fetchone()
        if row is None or not row["requested_employee_id"]:
            raise HTTPException(status_code=404, detail="Pending assignment request not found")
        if department_code and row["department_code"] != department_code:
            raise HTTPException(status_code=404, detail="Pending assignment request not found")
        cursor = db.execute(
            """UPDATE machines SET requested_employee_id = NULL, requested_at = NULL
               WHERE installation_id = ? AND requested_employee_id = ? AND requested_at = ?""",
            (str(installation_id), row["requested_employee_id"], row["requested_at"]),
        )
        if cursor.rowcount != 1:
            raise HTTPException(status_code=409, detail="Assignment request changed; refresh and try again")
    return {"status": "rejected", "installation_id": str(installation_id)}


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
        begin_write(db, "capture_events", "interactions", "machines")
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
                attachments_capture_status, attachments_truncated, employee_id, department_code,
                usage_context, usage_context_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                int(payload.attachments_truncated),
                machine.employee_id if machine else None,
                machine.department_code if machine else None,
                payload.usage_context,
                payload.usage_context_source,
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
        begin_write(db, "capture_events", "interactions", "responses")
        interaction = db.execute(
            "SELECT interaction_id, device_installation_id, machine_key_fingerprint, department_code FROM interactions WHERE interaction_id = ?", (str(interaction_id),)
        ).fetchone()
        if interaction is None:
            raise HTTPException(status_code=404, detail="interaction not found")
        if machine and (interaction["device_installation_id"] != machine.installation_id or
                        interaction["machine_key_fingerprint"] != machine.fingerprint or
                        (settings.app_env.lower() == "lab" and interaction["department_code"] != machine.department_code)):
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


@app.post(
    "/v1/stream-captures",
    response_model=StreamCaptureAccepted,
    status_code=status.HTTP_201_CREATED,
)
def create_stream_capture(
    payload: StreamCaptureCreate,
    response: Response,
    machine: Machine | None = Depends(require_machine_signature),
    settings: Settings = Depends(get_settings),
) -> StreamCaptureAccepted:
    if machine is None:
        raise HTTPException(status_code=403, detail="Assigned machine identity is required")
    if str(payload.device_installation_id) != machine.installation_id:
        raise HTTPException(status_code=409, detail="Machine and installation do not match")

    body = payload.model_dump(mode="json")
    body["machine_key_fingerprint"] = machine.fingerprint
    request_fingerprint = fingerprint(body)
    received_at = utc_now()
    capture_id = str(payload.capture_id)
    with connect(settings) as db:
        begin_write(db, "machines", "stream_captures")
        existing = db.execute(
            "SELECT request_fingerprint, received_at, attributed_person FROM stream_captures WHERE capture_id = ?",
            (capture_id,),
        ).fetchone()
        if existing:
            if existing["request_fingerprint"] != request_fingerprint:
                raise HTTPException(status_code=409, detail="capture_id was already used with different metadata")
            response.status_code = status.HTTP_200_OK
            return StreamCaptureAccepted(
                capture_id=payload.capture_id,
                status="stored",
                received_at=datetime.fromisoformat(existing["received_at"]),
                attributed_person=existing["attributed_person"],
                duplicate=True,
            )
        db.execute(
            """INSERT INTO stream_captures (
                capture_id, request_fingerprint, device_installation_id, attributed_person,
                machine_key_fingerprint, platform, path, request_id, status_code, content_type,
                capture_status, response_chars, bytes, chunks, frames, done_markers,
                protocol_done, reader_done, reader_aborted_after_done, truncated, stream_elapsed_ms,
                event_types_json, event_shapes_json, event_sequence_json, observed_at, received_at,
                employee_id, department_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                capture_id, request_fingerprint, machine.installation_id, machine.person_name,
                machine.fingerprint, payload.platform, payload.path, payload.request_id, payload.status_code,
                payload.content_type, payload.capture_status, payload.response_chars, payload.bytes,
                payload.chunks, payload.frames, payload.done_markers, int(payload.protocol_done),
                int(payload.reader_done), int(payload.reader_aborted_after_done), int(payload.truncated),
                payload.stream_elapsed_ms, json_dump(payload.event_types), json_dump(payload.event_shapes),
                json_dump(payload.event_sequence), iso(payload.observed_at), iso(received_at),
                machine.employee_id, machine.department_code,
            ),
        )
    return StreamCaptureAccepted(
        capture_id=payload.capture_id,
        status="stored",
        received_at=received_at,
        attributed_person=machine.person_name,
    )


@app.post("/v1/artifact-metadata", status_code=status.HTTP_201_CREATED)
def create_artifact_metadata(
    payload: ArtifactMetadataCreate,
    response: Response,
    machine: Machine | None = Depends(require_machine_signature),
    settings: Settings = Depends(get_settings),
) -> dict:
    if machine is None:
        raise HTTPException(status_code=403, detail="Assigned machine identity is required")
    if str(payload.device_installation_id) != machine.installation_id:
        raise HTTPException(status_code=409, detail="Machine and installation do not match")
    body = payload.model_dump(mode="json")
    for key in ("conversation_context", "size_source"):
        if body[key] is None:
            body.pop(key)
    body["machine_key_fingerprint"] = machine.fingerprint
    request_fingerprint = fingerprint(body)
    received_at = utc_now()
    artifact_id = str(payload.artifact_id)
    with connect(settings) as db:
        begin_write(db, "artifact_metadata", "machines")
        existing = db.execute(
            "SELECT request_fingerprint, received_at, attributed_person FROM artifact_metadata WHERE artifact_id = ?",
            (artifact_id,),
        ).fetchone()
        if existing:
            if existing["request_fingerprint"] != request_fingerprint:
                raise HTTPException(status_code=409, detail="artifact_id was already used with different metadata")
            response.status_code = status.HTTP_200_OK
            return {"artifact_id": artifact_id, "status": "stored", "received_at": existing["received_at"],
                    "attributed_person": existing["attributed_person"], "duplicate": True}
        db.execute(
            """INSERT INTO artifact_metadata (
                artifact_id, request_fingerprint, device_installation_id, attributed_person,
                machine_key_fingerprint, platform, source, file_name, mime_type, size_bytes,
                conversation_id, conversation_context_source, size_source, observed_at, received_at,
                employee_id, department_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (artifact_id, request_fingerprint, machine.installation_id, machine.person_name,
             machine.fingerprint, payload.platform, payload.source, payload.file_name, payload.mime_type,
             payload.size_bytes,
             str(payload.conversation_context.conversation_id) if payload.conversation_context else None,
             payload.conversation_context.source if payload.conversation_context else None,
             payload.size_source, iso(payload.observed_at), iso(received_at),
             machine.employee_id, machine.department_code),
        )
    return {"artifact_id": artifact_id, "status": "stored", "received_at": iso(received_at),
            "attributed_person": machine.person_name, "duplicate": False}


@app.get(
    "/v1/interactions/{interaction_id}",
    response_model=InteractionDetail,
)
def get_interaction(interaction_id: UUID, response: Response, viewer: dict = Depends(require_content_viewer),
                    settings: Settings = Depends(get_settings)) -> InteractionDetail:
    response.headers["Cache-Control"] = "no-store"
    with connect(settings) as db:
        row = db.execute("SELECT * FROM interactions WHERE interaction_id = ? AND (CAST(? AS TEXT) IS NULL OR department_code = ?)",
                         (str(interaction_id), viewer["department_code"], viewer["department_code"])).fetchone()
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
        record_privacy_audit(db, "content_read", viewer["actor_sub"],
                             "GET /v1/interactions/{interaction_id}", 1)
    return InteractionDetail(
        interaction_id=row["interaction_id"],
        client_event_id=row["client_event_id"],
        device_installation_id=row["device_installation_id"],
        platform=row["platform"],
        account_label=row["account_label"],
        attributed_person=row["attributed_person"],
        employee_id=row["employee_id"],
        department_code=row["department_code"],
        usage_context=row["usage_context"],
        usage_context_source=row["usage_context_source"],
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
