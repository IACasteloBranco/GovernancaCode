from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    app_host: str = "127.0.0.1"
    app_port: Annotated[int, Field(ge=1, le=65535)] = 8000
    database_path: Path = Path("./data/lab.sqlite3")
    capture_api_token: SecretStr | None = None
    operator_read_token: SecretStr | None = None
    lab_api_token: SecretStr | None = None
    retention_days: Annotated[int, Field(ge=1, le=365)] = 30
    max_prompt_chars: Annotated[int, Field(ge=1, le=1_000_000)] = 100_000
    max_response_chars: Annotated[int, Field(ge=1, le=1_000_000)] = 200_000
    max_url_chars: Annotated[int, Field(ge=1, le=8192)] = 4096
    max_attachments: Annotated[int, Field(ge=0, le=100)] = 20
    allowed_origins: str = ""
    machine_signature_required: bool = True
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: SecretStr | None = None
    google_extension_redirect_uri: str | None = None
    google_operator_sub: str | None = None
    pilot_department_code: str | None = None
    google_workspace_domain: str = "castelobrancocontabilidade.com.br"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    def validate_lab_configuration(self) -> None:
        if self.app_env.lower() not in {"local", "lab"}:
            raise ValueError("APP_ENV must be local or lab")
        if self.app_env.lower() == "lab":
            required = (self.google_oauth_client_id, self.google_oauth_client_secret,
                        self.google_extension_redirect_uri, self.google_workspace_domain)
            if not all(required):
                raise ValueError("Lab requires Google OAuth configuration")
            if not self.google_extension_redirect_uri.startswith("https://"):
                raise ValueError("Google extension redirect URI must use HTTPS")
            if not self.machine_signature_required:
                raise ValueError("Lab requires machine signatures")
            if self.app_host in {"0.0.0.0", "::"}:
                raise ValueError("In lab, bind to a private interface behind TLS and a firewall")
            return
        capture_token = self.capture_api_token or (self.lab_api_token if self.app_env.lower() == "local" else None)
        if capture_token is None or len(capture_token.get_secret_value()) < 24:
            raise ValueError("CAPTURE_API_TOKEN must contain at least 24 characters")
        if self.operator_read_token and len(self.operator_read_token.get_secret_value()) < 24:
            raise ValueError("OPERATOR_READ_TOKEN must contain at least 24 characters")
        if (capture_token and self.operator_read_token and
                capture_token.get_secret_value() == self.operator_read_token.get_secret_value()):
            raise ValueError("Capture and operator tokens must be different")


@lru_cache
def get_settings() -> Settings:
    return Settings()
