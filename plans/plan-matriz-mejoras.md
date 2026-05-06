# Plan de Implementación — Matriz: Asignación Interna + Email
> Para Cursor Composer 2 (agent mode)
> Leer `rules.md` antes de tocar cualquier archivo.

---

## CONTEXTO OBLIGATORIO — LEE ESTO PRIMERO

Este proyecto es una aplicación web interna de priorización de proyectos para Grupo ZYMO.

**Stack exacto:**
- Backend: Python 3.11 + FastAPI + SQLModel + SQLite + Uvicorn (sin Alembic — usa migraciones manuales en `database.py`)
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v3 + Zustand + TanStack Query
- Auth: JWT HS256 + bcrypt
- Realtime: WebSocket nativo via `ws_manager` (`backend/app/core/ws_manager.py`)
- Docker Compose para producción

**Reglas de arquitectura que DEBES respetar:**
1. La lógica de negocio va en `backend/app/services/`. Las routes (`backend/app/routes/`) solo orquestan: validan entrada, llaman al service, retornan respuesta.
2. Las migraciones de columnas nuevas van en `run_migrations()` dentro de `backend/app/database.py` — NUNCA uses Alembic ni `create_all()` para columnas nuevas en tablas existentes.
3. Los modelos nuevos SÍ se crean con `SQLModel.metadata.create_all()` (ya lo hace el lifespan), pero deben registrarse en `backend/app/models/__init__.py`.
4. El patrón de comentarios de estado usa `create_status_comment()` de `comment_service.py` — úsalo siempre que cambies el estado de un proyecto.
5. Los broadcasts de WebSocket van con `await ws_manager.broadcast(event_type, payload)` — úsalos en todas las mutaciones relevantes.
6. El tipo de comentario (`tipo`) tiene valores válidos. Con este plan se agrega `actualizacion` — no inventes otros.
7. NUNCA pongas credenciales, passwords ni secrets en el código fuente. Van en `.env`.

**Roles del sistema (jerarquía):**
```
usuario (0)      → Solo ve sus proyectos, puede comentar y subir evidencias
coordinador (1)  → Ve todos los proyectos, puede crear usuarios
admin (2)        → Escala, evalúa, completa ROI
superadmin (3)   → Aprueba, asigna preguntas, provee salarios, gestiona settings, asigna equipo dev
```

**State machine de proyectos (NO la rompas):**
```
pendiente_revision → escalado → preguntas_asignadas → en_evaluacion
→ evaluado → pendiente_salario → calculando_roi → aprobado_final
(rechazado disponible en cualquier paso)
```

---

## FEATURES A IMPLEMENTAR

### Feature A — Asignación interna del área de desarrollo
### Feature B — Equipo de desarrollo configurable en Settings
### Feature C — Configuración SMTP en BD (singleton)
### Feature D — Email con `aiosmtplib` directo
### Feature E — Tipo de comentario `actualizacion` dispara email
### Feature F — UI: sección SMTP + equipo en SettingsPage (solo superadmin)
### Feature G — UI: badge + acción "Asignar a Desarrollo" en detalle de proyecto

---

## FASE 0 — Setup y `.cursorrules`

**Archivo a crear: `.cursorrules` en la raíz del repo**

```
# Matriz — Cursor Rules

## Stack
- Backend: FastAPI + SQLModel + SQLite (Python 3.11)
- Frontend: React 19 + TypeScript + Tailwind v3 + Zustand + TanStack Query
- No Alembic. Migraciones manuales en backend/app/database.py → run_migrations()
- No fastapi-mail. Email con aiosmtplib directo.

## Patrones obligatorios
- Lógica de negocio SOLO en backend/app/services/
- Routes SOLO orquestan (validar → llamar service → retornar)
- Modelos nuevos: registrar en backend/app/models/__init__.py
- Columnas nuevas en tablas existentes: agregar en run_migrations()
- Cambios de estado de proyecto: usar create_status_comment() del comment_service
- Broadcasts WebSocket: await ws_manager.broadcast(event_type, payload)

## Convenciones de nombrado
- Archivos Python: snake_case
- Archivos TypeScript/React: PascalCase para componentes, camelCase para hooks/utils
- Endpoints REST: kebab-case (/assign-to-dev, /smtp-config)
- Eventos WebSocket: entidad.accion (project.assigned_dev, smtp.updated)

## NO hacer
- No usar Alembic
- No usar fastapi-mail
- No hardcodear emails ni credenciales
- No poner lógica de negocio en routes
- No crear archivos de migración separados
- No inventar tipos de comentario no definidos en el plan
```

---

## FASE 1 — Backend: Modelos nuevos

### 1.1 — Modelo `DevTeamMember`

**Archivo:** `backend/app/models/dev_team.py` (archivo nuevo)

```python
# backend/app/models/dev_team.py
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

class DevTeamMember(SQLModel, table=True):
    __tablename__ = "devteammember"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id", nullable=False, unique=True)
    added_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

### 1.2 — Modelo `SMTPConfig`

**Archivo:** `backend/app/models/smtp_config.py` (archivo nuevo)

```python
# backend/app/models/smtp_config.py
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

class SMTPConfig(SQLModel, table=True):
    __tablename__ = "smtpconfig"

    id: Optional[int] = Field(default=None, primary_key=True)
    # Siempre habrá una sola fila (singleton). id=1 siempre.

    host: str = Field(nullable=False)           # smtp.gmail.com
    port: int = Field(default=587, nullable=False)
    username: str = Field(nullable=False)        # correo que envía
    password: str = Field(nullable=False)        # App Password de Gmail
    use_tls: bool = Field(default=True, nullable=False)
    from_name: str = Field(default="Matriz ZYMO", nullable=False)
    notification_email: str = Field(nullable=False)  # info@logimat.com.co

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

### 1.3 — Columna `assigned_to_dev` en `Project`

**Archivo a modificar:** `backend/app/models/project.py`

Agregar campo al modelo `Project` (antes del campo `created_at`):

```python
# Asignación interna al área de Desarrollo e Innovación
assigned_to_dev: bool = Field(default=False, nullable=False)
assigned_to_dev_at: Optional[datetime] = Field(default=None, nullable=True)
assigned_to_dev_by: Optional[int] = Field(default=None, nullable=True)  # FK user.id (superadmin)
```

### 1.4 — Registrar modelos nuevos en `__init__.py`

**Archivo a modificar:** `backend/app/models/__init__.py`

Agregar imports:
```python
from app.models.dev_team import DevTeamMember
from app.models.smtp_config import SMTPConfig
```

Agregar a `__all__`:
```python
"DevTeamMember",
"SMTPConfig",
```

### 1.5 — Migraciones en `database.py`

**Archivo a modificar:** `backend/app/database.py`

Agregar al final de la lista `migrations` dentro de `run_migrations()`:

```python
# ── Feature: Asignación interna a desarrollo ───────────────────────────────
("project.assigned_to_dev",
 "ALTER TABLE project ADD COLUMN assigned_to_dev INTEGER NOT NULL DEFAULT 0"),
("project.assigned_to_dev_at",
 "ALTER TABLE project ADD COLUMN assigned_to_dev_at DATETIME"),
("project.assigned_to_dev_by",
 "ALTER TABLE project ADD COLUMN assigned_to_dev_by INTEGER"),
```

> NOTA: Las tablas `devteammember` y `smtpconfig` son nuevas — las crea `create_all()` automáticamente en el lifespan. No necesitan migración manual.

---

## FASE 2 — Backend: Schemas

### 2.1 — Schemas para DevTeam

**Archivo nuevo:** `backend/app/schemas/dev_team.py`

```python
from pydantic import BaseModel
from datetime import datetime

class DevTeamMemberRead(BaseModel):
    id: int
    user_id: int
    user_email: str        # se llena al leer, join con User
    user_full_name: str | None
    added_at: datetime
    model_config = {"from_attributes": True}

class DevTeamMemberCreate(BaseModel):
    user_id: int

class DevTeamMemberRemove(BaseModel):
    user_id: int
```

### 2.2 — Schemas para SMTPConfig

**Archivo nuevo:** `backend/app/schemas/smtp_config.py`

```python
from pydantic import BaseModel, EmailStr
from datetime import datetime

class SMTPConfigRead(BaseModel):
    id: int
    host: str
    port: int
    username: str
    # password NO se expone en GET — solo escritura
    use_tls: bool
    from_name: str
    notification_email: str
    updated_at: datetime
    model_config = {"from_attributes": True}

class SMTPConfigUpsert(BaseModel):
    host: str
    port: int = 587
    username: str
    password: str          # requerido siempre al guardar
    use_tls: bool = True
    from_name: str = "Matriz ZYMO"
    notification_email: str  # info@logimat.com.co

class SMTPTestRequest(BaseModel):
    pass  # Solo dispara el test con la config actual guardada en BD
```

### 2.3 — Actualizar schema de `ProjectRead`

**Archivo a modificar:** `backend/app/schemas/project.py`

Agregar campos a `ProjectRead`:
```python
assigned_to_dev: bool = False
assigned_to_dev_at: datetime | None = None
assigned_to_dev_by: int | None = None
```

### 2.4 — Validación de `tipo` en schema de comentario

**Archivo a modificar:** `backend/app/schemas/comment.py`

Reemplazar el campo `tipo` en `CommentCreate` por:
```python
from typing import Literal

tipo: Literal[
    "comentario",
    "cambio_estado",
    "feedback",
    "aprobacion",
    "actualizacion",
] = "comentario"
```

---

## FASE 3 — Backend: Services

### 3.1 — Servicio de email

**Archivo nuevo:** `backend/app/services/email_service.py`

Implementar con `aiosmtplib` (agregar al `requirements.txt`: `aiosmtplib==3.0.1`).

```python
# backend/app/services/email_service.py
import asyncio
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

import aiosmtplib
from sqlmodel import Session, select

from app.models.smtp_config import SMTPConfig

logger = logging.getLogger(__name__)


def get_smtp_config(db: Session) -> SMTPConfig | None:
    """Lee la config SMTP del singleton en BD. Retorna None si no existe."""
    return db.exec(select(SMTPConfig)).first()


async def send_email(
    db: Session,
    to: str,
    subject: str,
    body_html: str,
) -> bool:
    """
    Envía un email usando la config SMTP guardada en BD.
    Retorna True si se envió, False si falló o no hay config.
    NUNCA lanza excepción — el fallo de email no debe bloquear el flujo principal.
    """
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
        logger.info(f"[email] Enviado a {to} — Asunto: {subject}")
        return True
    except Exception as e:
        logger.error(f"[email] Fallo al enviar a {to}: {e}")
        return False


async def send_dev_assignment_notification(
    db: Session,
    project_title: str,
    project_id: int,
    assigned_by_name: str,
    team_emails: list[str],
) -> None:
    """
    Notifica a todo el equipo de desarrollo que se asignó un nuevo proyecto.
    Envía un correo por cada miembro del equipo.
    """
    subject = f"🚀 Nuevo proyecto asignado a Desarrollo: {project_title}"
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #E31E24;">Proyecto asignado al Área de Desarrollo</h2>
        <p>El proyecto <strong>"{project_title}"</strong> (ID #{project_id})
        ha sido asignado al área de Desarrollo e Innovación por
        <strong>{assigned_by_name}</strong>.</p>
        <p>El equipo de desarrollo será el responsable de ejecutar este proyecto.</p>
        <hr style="border-color: #eee;" />
        <p style="color: #999; font-size: 12px;">
            Notificación automática — Matriz ZYMO
        </p>
    </div>
    """
    tasks = [
        send_email(db, email, subject, body)
        for email in team_emails
        if email.strip()
    ]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def send_actualizacion_notification(
    db: Session,
    project_title: str,
    project_id: int,
    author_name: str,
    message: str,
) -> None:
    """
    Envía la actualización de un OKR al correo configurado en notification_email.
    Se dispara cuando alguien posta un comentario de tipo 'actualizacion'.
    """
    config = get_smtp_config(db)
    if not config:
        return

    subject = f"📋 Actualización OKR: {project_title}"
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #E31E24;">Actualización de Proyecto</h2>
        <p><strong>Proyecto:</strong> {project_title} (ID #{project_id})</p>
        <p><strong>Publicado por:</strong> {author_name}</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px;
                    border-left: 4px solid #E31E24; margin: 16px 0;">
            <p style="margin: 0;">{message}</p>
        </div>
        <hr style="border-color: #eee;" />
        <p style="color: #999; font-size: 12px;">
            Notificación automática — Matriz ZYMO
        </p>
    </div>
    """
    await send_email(db, config.notification_email, subject, body)
```

### 3.2 — Servicio de DevTeam

**Archivo nuevo:** `backend/app/services/dev_team_service.py`

```python
# backend/app/services/dev_team_service.py
from sqlmodel import Session, select
from app.models.dev_team import DevTeamMember
from app.models.user import User


def get_team_members(db: Session) -> list[tuple[DevTeamMember, User]]:
    """Retorna todos los miembros del equipo con su info de usuario."""
    members = db.exec(select(DevTeamMember)).all()
    result = []
    for m in members:
        user = db.get(User, m.user_id)
        if user:
            result.append((m, user))
    return result


def get_team_emails(db: Session) -> list[str]:
    """Retorna solo los emails del equipo para notificaciones."""
    pairs = get_team_members(db)
    return [user.email for _, user in pairs]


def add_team_member(db: Session, user_id: int) -> DevTeamMember:
    existing = db.exec(
        select(DevTeamMember).where(DevTeamMember.user_id == user_id)
    ).first()
    if existing:
        return existing
    member = DevTeamMember(user_id=user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def remove_team_member(db: Session, user_id: int) -> bool:
    member = db.exec(
        select(DevTeamMember).where(DevTeamMember.user_id == user_id)
    ).first()
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True
```

### 3.3 — Actualizar `comment_service.py` para disparar email en `actualizacion`

**Archivo a modificar:** `backend/app/services/comment_service.py`

Modificar la función `create_comment` para que, cuando `tipo == "actualizacion"`, dispare el email de forma async sin bloquear. El servicio de email se importa y se llama con `asyncio.create_task()` para no hacer el endpoint async-dependiente del SMTP.

```python
# Al inicio del archivo agregar:
import asyncio
from app.models.project import Project

# Modificar create_comment para aceptar db y disparar email:
async def create_comment_with_email(
    db: Session,
    project_id: int,
    author: User,
    payload: CommentCreate,
) -> ProjectComment:
    """
    Versión async de create_comment que dispara email si tipo == 'actualizacion'.
    Usar esta en la route de comments.
    """
    comment = create_comment(db, project_id, author, payload)

    if payload.tipo == "actualizacion":
        project = db.get(Project, project_id)
        if project:
            from app.services.email_service import send_actualizacion_notification
            # Fire and forget — no bloquea la respuesta HTTP
            asyncio.create_task(
                send_actualizacion_notification(
                    db=db,
                    project_title=project.title,
                    project_id=project_id,
                    author_name=author.full_name or author.email,
                    message=payload.message,
                )
            )
    return comment
```

> IMPORTANTE: Actualizar `backend/app/routes/comments.py` para usar `create_comment_with_email` en lugar de `create_comment` en el endpoint `POST`.

---

## FASE 4 — Backend: Routes nuevas

### 4.1 — Route: Asignación a desarrollo

**Archivo a modificar:** `backend/app/routes/projects.py`

Agregar endpoint al final del archivo:

```python
@router.post("/{project_id}/assign-to-dev", response_model=ProjectRead)
async def assign_to_dev(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Superadmin marca el proyecto como ejecutado por el área de Desarrollo.
    - Agrega flag assigned_to_dev = True
    - Notifica por email a todo el equipo configurado en DevTeamMember
    - No modifica el state machine ni remueve acceso del usuario original
      (usuario puede seguir comentando y subiendo evidencias)
    """
    from datetime import datetime, timezone
    from app.services.dev_team_service import get_team_emails
    from app.services.email_service import send_dev_assignment_notification

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")

    project.assigned_to_dev = True
    project.assigned_to_dev_at = datetime.now(timezone.utc)
    project.assigned_to_dev_by = current_user.id
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)

    # Comentario de estado
    sc = create_status_comment(
        db, project_id, current_user,
        f"Proyecto asignado al Área de Desarrollo por {current_user.full_name or current_user.email}."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.assigned_dev", {"id": project_id})

    # Notificar al equipo (fire and forget)
    team_emails = get_team_emails(db)
    if team_emails:
        import asyncio
        asyncio.create_task(
            send_dev_assignment_notification(
                db=db,
                project_title=project.title,
                project_id=project_id,
                assigned_by_name=current_user.full_name or current_user.email,
                team_emails=team_emails,
            )
        )

    return _read_with_evidence_count(db, project)


@router.delete("/{project_id}/assign-to-dev", response_model=ProjectRead)
async def unassign_from_dev(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Superadmin puede revertir la asignación a desarrollo."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")

    project.assigned_to_dev = False
    project.assigned_to_dev_at = None
    project.assigned_to_dev_by = None
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)

    await ws_manager.broadcast("project.unassigned_dev", {"id": project_id})
    return _read_with_evidence_count(db, project)
```

### 4.2 — Route: DevTeam CRUD

**Archivo nuevo:** `backend/app/routes/dev_team.py`

```python
# backend/app/routes/dev_team.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.core.dependencies import get_db, require_superadmin
from app.models.user import User
from app.schemas.dev_team import DevTeamMemberRead, DevTeamMemberCreate
from app.services.dev_team_service import get_team_members, add_team_member, remove_team_member

router = APIRouter(prefix="/settings/dev-team", tags=["DevTeam"])


@router.get("", response_model=list[DevTeamMemberRead])
def list_team(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    pairs = get_team_members(db)
    return [
        DevTeamMemberRead(
            id=m.id,
            user_id=m.user_id,
            user_email=u.email,
            user_full_name=u.full_name,
            added_at=m.added_at,
        )
        for m, u in pairs
    ]


@router.post("", response_model=DevTeamMemberRead, status_code=status.HTTP_201_CREATED)
def add_member(
    payload: DevTeamMemberCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    member = add_team_member(db, payload.user_id)
    return DevTeamMemberRead(
        id=member.id,
        user_id=member.user_id,
        user_email=user.email,
        user_full_name=user.full_name,
        added_at=member.added_at,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    removed = remove_team_member(db, user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Miembro no encontrado.")
```

### 4.3 — Route: SMTP Config

**Archivo nuevo:** `backend/app/routes/smtp_config.py`

```python
# backend/app/routes/smtp_config.py
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.dependencies import get_db, require_superadmin
from app.models.user import User
from app.models.smtp_config import SMTPConfig
from app.schemas.smtp_config import SMTPConfigRead, SMTPConfigUpsert
from app.services.email_service import send_email

router = APIRouter(prefix="/settings/smtp", tags=["SMTP"])


@router.get("", response_model=SMTPConfigRead)
def get_smtp(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    config = db.exec(select(SMTPConfig)).first()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración SMTP guardada.")
    return config


@router.put("", response_model=SMTPConfigRead)
def upsert_smtp(
    payload: SMTPConfigUpsert,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    """Crea o actualiza la configuración SMTP (singleton — siempre 1 fila)."""
    config = db.exec(select(SMTPConfig)).first()
    if config:
        for k, v in payload.model_dump().items():
            setattr(config, k, v)
        config.updated_at = datetime.now(timezone.utc)
    else:
        config = SMTPConfig(**payload.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.post("/test")
async def test_smtp(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Envía un email de prueba al notification_email configurado."""
    config = db.exec(select(SMTPConfig)).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configura el SMTP primero.")

    sent = await send_email(
        db=db,
        to=config.notification_email,
        subject="✅ Test SMTP — Matriz ZYMO",
        body_html=f"""
        <div style="font-family: Arial, sans-serif;">
            <h2 style="color: #E31E24;">Configuración SMTP funcionando</h2>
            <p>Este es un correo de prueba enviado por <strong>{current_user.full_name or current_user.email}</strong>.</p>
            <p>Si recibes esto, la configuración SMTP está correcta.</p>
        </div>
        """,
    )
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="No se pudo enviar el email. Revisa host, puerto, usuario y contraseña."
        )
    return {"ok": True, "sent_to": config.notification_email}
```

### 4.4 — Registrar routes nuevas en `main.py`

**Archivo a modificar:** `backend/app/main.py`

Agregar imports y `include_router`:

```python
from app.routes.dev_team import router as dev_team_router
from app.routes.smtp_config import router as smtp_config_router

# En la sección de app.include_router():
app.include_router(dev_team_router)
app.include_router(smtp_config_router)
```

### 4.5 — Actualizar `requirements.txt`

**Archivo a modificar:** `backend/requirements.txt`

Agregar:
```
aiosmtplib==3.0.1
```

---

## FASE 5 — Frontend: Types

### 5.1 — Tipos nuevos

**Archivo nuevo:** `frontend/src/types/dev_team.ts`
```typescript
export interface DevTeamMember {
  id: number
  user_id: number
  user_email: string
  user_full_name: string | null
  added_at: string
}
```

**Archivo nuevo:** `frontend/src/types/smtp.ts`
```typescript
export interface SMTPConfig {
  id: number
  host: string
  port: number
  username: string
  use_tls: boolean
  from_name: string
  notification_email: string
  updated_at: string
}

export interface SMTPConfigUpsert {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
  from_name: string
  notification_email: string
}
```

**Archivo a modificar:** `frontend/src/types/project.ts`

Agregar campos a la interface `Project`:
```typescript
assigned_to_dev: boolean
assigned_to_dev_at: string | null
assigned_to_dev_by: number | null
```

**Archivo a modificar:** `frontend/src/types/comment.ts`

Actualizar el tipo de `tipo`:
```typescript
tipo: "comentario" | "cambio_estado" | "feedback" | "aprobacion" | "actualizacion"
```

---

## FASE 6 — Frontend: Hooks

### 6.1 — Hook para DevTeam

**Archivo nuevo:** `frontend/src/hooks/useDevTeam.ts`

Implementar con TanStack Query:
- `useDevTeam()` — GET `/settings/dev-team`
- `useAddDevTeamMember()` — POST `/settings/dev-team` con `user_id`
- `useRemoveDevTeamMember()` — DELETE `/settings/dev-team/{user_id}`
- Invalidar query `["dev-team"]` en mutaciones

### 6.2 — Hook para SMTP

**Archivo nuevo:** `frontend/src/hooks/useSMTP.ts`

Implementar con TanStack Query:
- `useSMTPConfig()` — GET `/settings/smtp` (maneja 404 retornando `null`)
- `useUpsertSMTP()` — PUT `/settings/smtp`
- `useTestSMTP()` — POST `/settings/smtp/test`

### 6.3 — Hook para asignación a desarrollo

**Archivo a modificar:** `frontend/src/hooks/useProjectActions.ts`

Agregar:
- `assignToDev(projectId)` — POST `/projects/{id}/assign-to-dev`
- `unassignFromDev(projectId)` — DELETE `/projects/{id}/assign-to-dev`
- Invalidar queries `["projects"]` y `["project", projectId]`

---

## FASE 7 — Frontend: Componentes

### 7.1 — Componente: `DevTeamManager`

**Archivo nuevo:** `frontend/src/components/settings/DevTeamManager.tsx`

Funcionalidad:
- Lista los miembros actuales del equipo con nombre y email
- Dropdown/select para agregar un usuario existente del sistema (necesita también un endpoint GET `/auth/users` que ya existe — úsalo para poblar el select)
- Botón "Eliminar" por miembro con confirmación
- Solo visible para superadmin
- Manejo de estado loading/error inline

### 7.2 — Componente: `SMTPConfigForm`

**Archivo nuevo:** `frontend/src/components/settings/SMTPConfigForm.tsx`

Funcionalidad:
- Formulario con campos: Host SMTP, Puerto, Usuario (email), Contraseña, Usar TLS (toggle), Nombre del remitente, Email de notificación
- El campo contraseña es siempre `type="password"` — nunca mostrar el valor guardado (llegar en blanco, al guardar si está vacío no actualizar)
- Botón "Guardar configuración"
- Botón "Enviar email de prueba" (llama al endpoint `/test`) — mostrar resultado inline con Toast
- Indicador visual si hay config guardada o no
- Solo visible para superadmin

### 7.3 — Actualizar `SettingsPage.tsx`

**Archivo a modificar:** `frontend/src/pages/SettingsPage.tsx`

Agregar dos nuevas tabs o secciones al final de la página (después de las categorías y preguntas existentes):
- **"Equipo de Desarrollo"** — renderiza `<DevTeamManager />`
- **"Configuración de Email"** — renderiza `<SMTPConfigForm />`

Ambas secciones solo visibles si el usuario tiene rol `superadmin`. Usar la función `canAccessSettings` y también verificar `user.role === "superadmin"` para las secciones nuevas.

### 7.4 — Badge y acción en detalle de proyecto

**Archivo a modificar:** `frontend/src/pages/ProjectDetailShowcasePage.tsx`

Agregar:

1. **Badge visual** visible para todos: cuando `project.assigned_to_dev === true`, mostrar un badge con el texto "Área de Desarrollo" con el color accent `#E31E24`. Posicionarlo cerca del título o en el header del proyecto.

2. **Botón de acción** (solo superadmin): Si `assigned_to_dev === false`, mostrar botón "Asignar a Desarrollo". Si es `true`, mostrar botón "Quitar asignación". Usar `assignToDev` / `unassignFromDev` del hook. Mostrar loading state durante la mutación.

### 7.5 — Selector de tipo en `ProjectChat`

**Archivo a modificar:** `frontend/src/components/chat/ProjectChat.tsx`

Agregar selector de tipo de mensaje (solo para admin/superadmin — usuarios siempre mandan `tipo: "comentario"`):

- Opciones disponibles para admin+: `comentario`, `actualizacion`
- La opción `actualizacion` muestra un tooltip o texto explicativo: "Enviará un correo de notificación a info@logimat.com.co"
- El tipo `cambio_estado`, `feedback`, `aprobacion` siguen siendo solo para el sistema — no los expongas en el selector manual

---

## FASE 8 — Verificación final

### Checklist que Cursor debe ejecutar antes de marcar como completo:

**Backend:**
- [ ] `python -c "from app.models import DevTeamMember, SMTPConfig; print('OK')"` — sin errores de import
- [ ] Arrancar con `uvicorn app.main:app --reload` — sin errores en lifespan
- [ ] Las tablas `devteammember` y `smtpconfig` existen en la BD tras el arranque
- [ ] Las columnas `assigned_to_dev`, `assigned_to_dev_at`, `assigned_to_dev_by` existen en tabla `project`
- [ ] `GET /settings/smtp` retorna 404 si no hay config (correcto) o 200 con datos
- [ ] `POST /settings/smtp/test` retorna **404** si no hay SMTP guardado, o **502** si existe config pero falla el envío
- [ ] `POST /projects/{id}/assign-to-dev` solo lo puede llamar superadmin (401/403 para otros roles)
- [ ] Al postear un comentario con `tipo: "actualizacion"`, no se bloquea la respuesta HTTP aunque el SMTP falle

**Frontend:**
- [ ] `pnpm build` (o `npm run build`) sin errores TypeScript
- [ ] En `SettingsPage`, las secciones "Equipo de Desarrollo" y "Configuración de Email" solo aparecen para superadmin
- [ ] El badge "Área de Desarrollo" aparece en el detalle del proyecto cuando corresponde
- [ ] El selector de tipo en el chat no muestra `cambio_estado`, `feedback`, `aprobacion` como opciones manuales
- [ ] El campo contraseña en SMTPConfigForm nunca expone el valor guardado

---

## NOTAS IMPORTANTES PARA EL AGENTE

1. **No uses `create_all()` para agregar columnas a tablas existentes** — solo agrega las entradas al array `migrations` en `run_migrations()` de `database.py`.

2. **El `asyncio.create_task()` para el email es intencional** — permite que el endpoint responda inmediatamente sin esperar el SMTP. No lo cambies a `await`.

3. **El singleton de SMTPConfig es una sola fila** — el PUT hace upsert (busca primero, crea si no existe). Nunca crees múltiples filas.

4. **No expongas `password` en el GET de SMTP** — el schema `SMTPConfigRead` no tiene ese campo. Si el frontend necesita saber si hay contraseña guardada, agrega un campo `has_password: bool` al read schema.

5. **El tipo `actualizacion` en comentarios es solo para usuarios con rol `admin` o `superadmin`** en el frontend. El backend no necesita validar esto (el frontend lo controla), pero si quieres agregar validación en el backend también es bienvenida.

6. **Lee `rules.md` completo antes de empezar** — contiene convenciones de código específicas de este proyecto.

7. **Orden de ejecución:** Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. No saltes fases.
