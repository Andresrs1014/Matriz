import asyncio
import html
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.dependencies import get_db, require_superadmin
from app.models.user import User
from app.schemas.smtp_config import SMTPConfigRead, SMTPConfigUpsert
from app.services.email_service import send_email
from app.services.smtp_config_service import load_smtp_row, upsert_smtp_singleton

router = APIRouter(prefix="/settings/smtp", tags=["SMTP"])
logger = logging.getLogger(__name__)


def _smtp_read(row) -> SMTPConfigRead:
    return SMTPConfigRead.model_validate(row)


@router.get("", response_model=SMTPConfigRead)
def get_smtp(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    row = load_smtp_row(db)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay configuración SMTP guardada.")
    return _smtp_read(row)


@router.put("", response_model=SMTPConfigRead)
def upsert_smtp(
    payload: SMTPConfigUpsert,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    row = upsert_smtp_singleton(db, payload)
    return _smtp_read(row)


@router.post("/test")
async def test_smtp(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Envía un email de prueba al notification_email guardado."""
    config = load_smtp_row(db)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configura el SMTP primero.",
        )
    actor = html.escape(current_user.full_name or current_user.email or "superadmin")

    sent = False
    try:
        sent = await asyncio.wait_for(
            send_email(
                db,
                to=config.notification_email,
                subject="✅ Test SMTP — Matriz ZYMO",
                body_html=f"""
        <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #E31E24;">Configuración SMTP funcionando</h2>
            <p>Este es un correo de prueba enviado por <strong>{actor}</strong>.</p>
            <p>Si recibes esto, la configuración SMTP está correcta.</p>
        </div>
        """,
            ),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="El servidor SMTP tardó demasiado. Revisa host, puerto y red.",
        ) from None
    except Exception:
        logger.exception("[smtp] test_smtp envío falló")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo enviar el email. Revisa host, puerto, usuario y contraseña.",
        ) from None
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo enviar el email. Revisa host, puerto, usuario y contraseña.",
        )
    return {"ok": True, "sent_to": config.notification_email}
