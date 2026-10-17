import hmac
from typing import Annotated

import cachecontrol
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.exceptions import TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token

from .settings import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)
_google_request = GoogleRequest(session=cachecontrol.CacheControl(requests.Session()))


def _require_token(supplied: str, expected: str | None, detail: str) -> None:
    if not expected or not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def verify_google_token(token: str, settings: Settings, nonce: str | None = None) -> dict:
    if not token or not settings.google_oauth_client_id:
        raise HTTPException(status_code=401, detail="Invalid or missing Google token")
    try:
        claims = id_token.verify_oauth2_token(token, _google_request, settings.google_oauth_client_id)
    except TransportError as error:
        raise HTTPException(status_code=503, detail="Google identity verification unavailable") from error
    except (ValueError, requests.RequestException) as error:
        raise HTTPException(status_code=401, detail="Invalid or missing Google token") from error
    if (claims.get("hd") != settings.google_workspace_domain or not claims.get("sub") or
            not claims.get("email") or not isinstance(claims.get("exp"), int) or
            claims.get("email_verified") is not True or
            (nonce is not None and claims.get("nonce") != nonce)):
        raise HTTPException(status_code=401, detail="Google identity is not authorized")
    return claims


def require_capture_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> str | None:
    supplied = credentials.credentials if credentials and credentials.scheme.lower() == "bearer" else ""
    if settings.app_env.lower() == "lab":
        if not settings.pilot_department_code:
            raise HTTPException(status_code=403, detail="Pilot department is not configured")
        return verify_google_token(supplied, settings)["sub"]
    token = settings.capture_api_token or (settings.lab_api_token if settings.app_env.lower() == "local" else None)
    expected = token.get_secret_value() if token else None
    _require_token(supplied, expected, "Invalid or missing capture token")
    return None


def require_machine_viewer(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> str | None:
    if settings.app_env.lower() != "lab":
        return None
    supplied = credentials.credentials if credentials and credentials.scheme.lower() == "bearer" else ""
    return verify_google_token(supplied, settings)["sub"]


def require_operator_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> str | None:
    supplied = credentials.credentials if credentials and credentials.scheme.lower() == "bearer" else ""
    if settings.app_env.lower() == "lab":
        claims = verify_google_token(supplied, settings)
        if not settings.google_operator_sub or not settings.pilot_department_code or claims["sub"] != settings.google_operator_sub:
            raise HTTPException(status_code=403, detail="Operator access denied")
        return settings.pilot_department_code
    expected = settings.operator_read_token.get_secret_value() if settings.operator_read_token else None
    _require_token(supplied, expected, "Invalid or missing operator token")
    return None
