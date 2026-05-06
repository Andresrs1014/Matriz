# backend/app/models/smtp_config.py
from datetime import datetime, timezone
from typing import ClassVar, Optional

from sqlmodel import Field, SQLModel


class SMTPConfig(SQLModel, table=True):
    __tablename__: ClassVar[str] = "smtpconfig"

    id: Optional[int] = Field(default=None, primary_key=True)
    host: str = Field(nullable=False)
    port: int = Field(default=587, nullable=False)
    username: str = Field(nullable=False)
    password: str = Field(nullable=False)
    use_tls: bool = Field(default=True, nullable=False)
    from_name: str = Field(default="Matriz ZYMO", nullable=False)
    notification_email: str = Field(nullable=False)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
