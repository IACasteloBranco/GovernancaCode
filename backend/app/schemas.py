from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .settings import get_settings


CaptureStatus = Literal["observed", "unknown", "unavailable", "metadata_only"]


class ObservedField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=512)
    url: str | None = Field(default=None, max_length=4096)
    capture_status: CaptureStatus
    reason: str | None = Field(default=None, max_length=512)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) > get_settings().max_url_chars:
            raise ValueError("URL exceeds configured size limit")
        if not value.startswith(("https://", "http://")):
            raise ValueError("URL must use HTTP or HTTPS")
        return value

    @model_validator(mode="after")
    def explain_missing_context(self) -> "ObservedField":
        if self.capture_status in {"unknown", "unavailable"} and not self.reason:
            raise ValueError("reason is required when context is unknown or unavailable")
        return self


class PromptField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    capture_status: Literal["observed", "unavailable"] = "observed"
    reason: str | None = Field(default=None, max_length=512)

    @field_validator("text")
    @classmethod
    def enforce_prompt_limit(cls, value: str) -> str:
        if len(value) > get_settings().max_prompt_chars:
            raise ValueError("prompt exceeds configured size limit")
        return value


class AttachmentMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=512)
    mime_type: str | None = Field(default=None, max_length=255)
    size_bytes: int | None = Field(default=None, ge=0, le=9007199254740991, strict=True)
    capture_status: Literal["metadata_only", "presence_only", "unavailable"]
    source: Literal["visible_card", "selection_event"] | None = None

    @model_validator(mode="after")
    def validate_metadata(self) -> "AttachmentMetadata":
        if self.capture_status == "presence_only" and any(value is not None for value in (self.name, self.mime_type, self.size_bytes)):
            raise ValueError("presence_only cannot contain metadata")
        return self


class FileObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    capture_status: Literal["observed", "not_observed", "unavailable"] = "unavailable"
    items: list[AttachmentMetadata] = Field(default_factory=list)
    truncated: bool = False

    @model_validator(mode="after")
    def validate_observation(self) -> "FileObservation":
        if len(self.items) > get_settings().max_attachments:
            raise ValueError("too many file metadata entries")
        if self.capture_status != "observed" and (self.items or self.truncated):
            raise ValueError("file evidence requires observed status")
        return self


class InteractionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["0.1"]
    client_event_id: UUID
    platform: Literal["chatgpt_web", "claude_web"]
    device_installation_id: UUID
    account_label: str | None = Field(default=None, max_length=320)
    project: ObservedField
    conversation: ObservedField
    prompt: PromptField
    attachments: list[AttachmentMetadata] = Field(default_factory=list)
    attachments_capture_status: Literal["observed", "not_observed", "unavailable"] = "unavailable"
    attachments_truncated: bool = False
    adapter_version: str = Field(min_length=1, max_length=64)
    observed_at: datetime

    @model_validator(mode="after")
    def validate_attachment_observation(self) -> "InteractionCreate":
        if self.attachments_capture_status == "not_observed" and self.attachments:
            raise ValueError("attachment evidence requires observed status")
        if self.attachments_truncated and self.attachments_capture_status != "observed":
            raise ValueError("truncation requires observed status")
        return self

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("observed_at must include a timezone")
        return value.astimezone(timezone.utc)

    @field_validator("attachments")
    @classmethod
    def enforce_attachment_limit(cls, value: list[AttachmentMetadata]) -> list[AttachmentMetadata]:
        if len(value) > get_settings().max_attachments:
            raise ValueError("too many attachment metadata entries")
        return value


class ResponseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_event_id: UUID
    text: str
    generated_materials: FileObservation = Field(default_factory=FileObservation)
    capture_status: Literal["complete", "incomplete"]
    observed_at: datetime
    adapter_version: str | None = Field(default=None, max_length=64)

    @field_validator("text")
    @classmethod
    def enforce_response_limit(cls, value: str) -> str:
        if len(value) > get_settings().max_response_chars:
            raise ValueError("response exceeds configured size limit")
        return value

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("observed_at must include a timezone")
        return value.astimezone(timezone.utc)


class EventRecord(BaseModel):
    event_type: str
    result: str
    error_code: str | None
    occurred_at: datetime


class InteractionAccepted(BaseModel):
    interaction_id: UUID
    status: str
    received_at: datetime
    duplicate: bool = False


class ResponseAccepted(BaseModel):
    interaction_id: UUID
    status: str
    received_at: datetime
    duplicate: bool = False


class HealthResponse(BaseModel):
    status: Literal["ok"]
    schema_version: Literal["0.1"]


class InteractionDetail(BaseModel):
    interaction_id: UUID
    client_event_id: UUID
    device_installation_id: UUID
    platform: str
    account_label: str | None
    attributed_person: str | None = None
    project_id: str | None = None
    machine_key_fingerprint: str | None = None
    project: dict[str, Any]
    conversation: dict[str, Any]
    prompt: dict[str, Any]
    attachments: list[dict[str, Any]]
    attachments_capture_status: str
    attachments_truncated: bool
    adapter_version: str
    status: str
    observed_at: datetime
    received_at: datetime
    source_ip: str | None
    responses: list[dict[str, Any]]
    events: list[EventRecord]
