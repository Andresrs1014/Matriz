"""Persistencia SMTP (singleton). La ruta solo orquesta."""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.smtp_config import SMTPConfig
from app.schemas.smtp_config import SMTPConfigUpsert


def load_smtp_row(db: Session) -> SMTPConfig | None:
    return db.exec(select(SMTPConfig)).first()


def upsert_smtp_singleton(db: Session, payload: SMTPConfigUpsert) -> SMTPConfig:
    raw = payload.model_dump()
    pwd = (raw.pop("password") or "").strip()
    now = datetime.now(timezone.utc)
    row = load_smtp_row(db)
    if row:
        for key, val in raw.items():
            setattr(row, key, val)
        if pwd:
            row.password = pwd
        row.updated_at = now
        db.add(row)
    else:
        if not pwd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña SMTP es obligatoria en el primer guardado.",
            )
        row = SMTPConfig(**raw, password=pwd)
        row.updated_at = now
        db.add(row)
    db.commit()
    db.refresh(row)
    return row
