import asyncio
import html
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from sqlmodel import Session, select

from app.database import get_engine
from app.models.smtp_config import SMTPConfig

logger = logging.getLogger(__name__)


def _dedupe_email_recipients(emails: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in emails:
        addr = (raw or "").strip()
        if not addr:
            continue
        key = addr.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(addr)
    return out


def get_smtp_config(db: Session) -> SMTPConfig | None:
    return db.exec(select(SMTPConfig)).first()


async def send_email(
    db: Session,
    to: str,
    subject: str,
    body_html: str,
) -> bool:
    config = get_smtp_config(db)
    if not config:
        logger.warning("[email] No hay configuración SMTP guardada. Email no enviado.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{config.from_name} <{config.username}>"
    msg["To"] = to
    msg.attach(MIMEText(body_html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=config.host,
            port=config.port,
            username=config.username,
            password=config.password,
            start_tls=config.use_tls,
        )
        logger.info("[email] Enviado a %s — Asunto: %s", to, subject)
        return True
    except Exception as e:
        logger.error("[email] Fallo al enviar a %s: %s", to, e)
        return False


async def send_dev_assignment_notification(
    db: Session,
    project_title: str,
    project_id: int,
    assigned_by_name: str,
    team_emails: list[str],
) -> None:
    subject = f"🚀 Nuevo proyecto asignado a Desarrollo: {project_title}"
    safe_title = html.escape(project_title, quote=False)
    safe_actor = html.escape(assigned_by_name, quote=False)
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #E31E24;">Proyecto asignado al Área de Desarrollo</h2>
        <p>El proyecto <strong>"{safe_title}"</strong> (ID #{project_id})
        ha sido asignado al área de Desarrollo e Innovación por
        <strong>{safe_actor}</strong>.</p>
        <p>El equipo de desarrollo será el responsable de ejecutar este proyecto.</p>
        <hr style="border-color: #eee;" />
        <p style="color: #999; font-size: 12px;">
            Notificación automática — Matriz ZYMO
        </p>
    </div>
    """
    tasks = [
        send_email(db, email.strip(), subject, body)
        for email in team_emails
        if email.strip()
    ]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


def _html_escape_message_paragraph(text: str) -> str:
    escaped = html.escape(text, quote=True).replace("\n", "<br/>")
    return f'<p style="margin: 0;">{escaped}</p>'


async def send_actualizacion_notification(
    db: Session,
    project_title: str,
    project_id: int,
    author_name: str,
    message: str,
) -> None:
    from app.services.dev_team_service import get_team_emails

    config = get_smtp_config(db)
    if not config:
        return

    subject = f"📋 Actualización OKR: {project_title}"
    safe_title = html.escape(project_title, quote=False)
    safe_author = html.escape(author_name, quote=False)
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #E31E24;">Actualización de Proyecto</h2>
        <p><strong>Proyecto:</strong> {safe_title} (ID #{project_id})</p>
        <p><strong>Publicado por:</strong> {safe_author}</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px;
                    border-left: 4px solid #E31E24; margin: 16px 0;">
            {_html_escape_message_paragraph(message)}
        </div>
        <hr style="border-color: #eee;" />
        <p style="color: #999; font-size: 12px;">
            Notificación automática — Matriz ZYMO
        </p>
    </div>
    """
    team = get_team_emails(db)
    inbox = (config.notification_email or "").strip()
    recipients = _dedupe_email_recipients([*team, inbox])
    if not recipients:
        logger.warning(
            "[email] Actualización OKR sin destinatarios (sin equipo en settings ni notification_email)"
        )
        return
    tasks = [send_email(db, addr, subject, body) for addr in recipients]
    await asyncio.gather(*tasks, return_exceptions=True)


async def send_actualizacion_notification_detached(
    *,
    project_title: str,
    project_id: int,
    author_name: str,
    message: str,
) -> None:
    """Ejecutado en segundo plano: abre su propia sesión de BD."""
    try:
        with Session(get_engine()) as db:
            await send_actualizacion_notification(
                db,
                project_title=project_title,
                project_id=project_id,
                author_name=author_name,
                message=message,
            )
    except Exception as e:
        logger.error("[email] send_actualizacion_notification_detached: %s", e)


async def send_area_assignment_notification_detached(
    *,
    project_title: str,
    project_id: int,
    area_name: str,
    assigned_by_name: str,
    recipient_emails: list[str],
) -> None:
    try:
        with Session(get_engine()) as db:
            await send_area_assignment_notification(
                db,
                project_title=project_title,
                project_id=project_id,
                area_name=area_name,
                assigned_by_name=assigned_by_name,
                recipient_emails=recipient_emails,
            )
    except Exception as e:
        logger.error("[email] send_area_assignment_notification_detached: %s", e)


async def send_area_assignment_notification(
    db: Session,
    *,
    project_title: str,
    project_id: int,
    area_name: str,
    assigned_by_name: str,
    recipient_emails: list[str],
) -> None:
    recipient_emails = _dedupe_email_recipients(recipient_emails)
    config = get_smtp_config(db)
    if not config or not recipient_emails:
        return
    subject = f"📂 Proyecto asignado a tu área: {project_title}"
    safe_title = html.escape(project_title, quote=False)
    safe_area = html.escape(area_name, quote=False)
    safe_actor = html.escape(assigned_by_name, quote=False)
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #E31E24;">Proyecto asignado a {safe_area}</h2>
        <p>El proyecto <strong>"{safe_title}"</strong> (ID #{project_id})
        fue asignado a tu área por <strong>{safe_actor}</strong>.</p>
        <hr style="border-color: #eee;" />
        <p style="color: #999; font-size: 12px;">Notificación automática — Matriz ZYMO</p>
    </div>
    """
    tasks = [send_email(db, email, subject, body) for email in recipient_emails if email.strip()]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def send_dev_assignment_notification_detached(
    *,
    project_title: str,
    project_id: int,
    assigned_by_name: str,
    team_emails: list[str],
) -> None:
    """Segundo plano: evita usar el Session del request tras cerrar la petición."""
    if not team_emails:
        return
    try:
        with Session(get_engine()) as db:
            await send_dev_assignment_notification(
                db,
                project_title=project_title,
                project_id=project_id,
                assigned_by_name=assigned_by_name,
                team_emails=team_emails,
            )
    except Exception as e:
        logger.error("[email] send_dev_assignment_notification_detached: %s", e)

