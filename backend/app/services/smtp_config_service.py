"""Persistencia SMTP (singleton). La ruta solo orquesta."""
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models.smtp_config import SMTPConfig
from app.schemas.smtp_config import SMTPConfigUpsert


def load_smtp_row(db: Session) -> SMTPConfig | None:
    return db.exec(select(SMTPConfig)).first()


def upsert_smtp_singleton(db: Session, payload: SMTPConfigUpsert) -> SMTPConfig:
    data = payload.model_dump()
    now = datetime.now(timezone.utc)
    row = load_smtp_row(db)
    if row:
        for key, val in data.items():
            setattr(row, key, val)
        row.updated_at = now
        db.add(row)
    else:
        row = SMTPConfig(**data)
        row.updated_at = now
        db.add(row)
    db.commit()
    db.refresh(row)
    return row
