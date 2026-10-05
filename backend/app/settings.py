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
    lab_api_token: SecretStr
    retention_days: Annotated[int, Field(ge=1, le=365)] = 7
    max_prompt_chars: Annotated[int, Field(ge=1, le=1_000_000)] = 100_000
    max_response_chars: Annotated[int, Field(ge=1, le=1_000_000)] = 200_000
    max_url_chars: Annotated[int, Field(ge=1, le=8192)] = 4096
    max_attachments: Annotated[int, Field(ge=0, le=100)] = 20
    allowed_origins: str = ""
    machine_signature_required: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    def validate_lab_configuration(self) -> None:
        token = self.lab_api_token.get_secret_value()
        if len(token) < 24:
            raise ValueError("LAB_API_TOKEN must contain at least 24 characters")
        if self.app_env.lower() == "lab" and self.app_host in {"0.0.0.0", "::"}:
            raise ValueError("In lab, bind to a private interface behind TLS and a firewall")


@lru_cache
def get_settings() -> Settings:
    return Settings()
