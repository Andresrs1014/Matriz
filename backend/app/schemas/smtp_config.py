from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator


class SMTPConfigRead(BaseModel):
    id: int
    host: str
    port: int
    username: str
    use_tls: bool
    from_name: str
    notification_email: str
    updated_at: datetime
    has_password: bool = False

    @model_validator(mode="before")
    @classmethod
    def build_from_row(cls, data: Any) -> Any:
        from app.models.smtp_config import SMTPConfig

        if isinstance(data, SMTPConfig):
            return {
                "id": data.id,
                "host": data.host,
                "port": data.port,
                "username": data.username,
                "use_tls": data.use_tls,
                "from_name": data.from_name,
                "notification_email": data.notification_email,
                "updated_at": data.updated_at,
                "has_password": bool((data.password or "").strip()),
            }
        return data


class SMTPConfigUpsert(BaseModel):
    host: str
    port: int = 587
    username: str
    password: str
    use_tls: bool = True
    from_name: str = "Matriz ZYMO"
    notification_email: str


class SMTPTestRequest(BaseModel):
    pass
