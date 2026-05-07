# Plan de Implementación — Modificar Fecha de Proyecto por Usuario/Coordinador

> Para opencode (agent mode)

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
4. El patrón de comentarios de estado usa `create_status_comment()` del `comment_service.py` — úsalo siempre que cambies el estado de un proyecto.
5. Los broadcasts de WebSocket van con `await ws_manager.broadcast(event_type, payload)` — úsalos en todas las mutaciones relevantes.
6. El tipo de comentario (`tipo`) tiene valores válidos. Con este plan se agrega `extension_fecha` — no inventes otros.
7. NUNCA pongas credenciales, passwords ni secrets en el código fuente. Van en `.env`.

**Roles del sistema (jerarquía):**
```
usuario (0)      → Solo ve sus proyectos, puede comentar y subir evidencias
coordinador (1)  → Ve todos los proyectos, puede crear usuarios
admin (2)        → Escala, evalúa, completa ROI
superadmin (3)   → Aprueba, asigna preguntas, provee salarios, gestiona settings, asigna equipo dev
```

---

## PROBLEMA ACTUAL

El endpoint `PATCH /projects/{id}/due-date` (línea 578-603 en `projects.py`) requiere rol `admin` o superior. Los usuarios y coordinadores NO pueden modificar la fecha de vencimiento de sus propios proyectos.

## REQUERIMIENTO

Permitir que:
1. **Usuario** pueda modificar la fecha de vencimiento de **sus propios proyectos**
2. **Coordinador** pueda modificar la fecha de vencimiento de **sus propios proyectos**
3. Al modificar la fecha, el usuario debe ingresar una **justificación** del motivo de la extensión
4. Se debe crear un **comentario de tipo `extension_fecha`** en el proyecto con la justificación
5. Se debe **notificar por email** cuando alguien extiende la fecha de un proyecto

---

## FEATURES A IMPLEMENTAR

### Feature A — Backend: Nuevo endpoint para extensión de fecha por propietario
### Feature B — Backend: Schemas actualizados para justificación
### Feature C — Backend: Notificación por email al extender fecha
### Feature D — Frontend: UI para editar fecha con justificación

---

## FASE 1 — Backend: Schema nuevo

### 1.1 — Schema para extensión de fecha

**Archivo a modificar:** `backend/app/schemas/project.py`

Agregar nuevo schema para la solicitud de extensión de fecha:

```python
from pydantic import BaseModel
from datetime import date

class DueDateExtendInput(BaseModel):
    due_date: date  # Nueva fecha de vencimiento
    justificacion: str  # Obligatoria, mínimo 10 caracteres
```

### 1.2 — Actualizar tipos de comentario

**Archivo a modificar:** `backend/app/schemas/comment.py`

Agregar `extension_fecha` a los tipos válidos:

```python
tipo: Literal[
    "comentario",
    "cambio_estado",
    "feedback",
    "aprobacion",
    "actualizacion",
    "extension_fecha",  # <-- AGREGAR ESTE
] = "comentario"
```

---

## FASE 2 — Backend: Actualizar servicio de email

### 2.1 — Agregar función de notificación de extensión

**Archivo a modificar:** `backend/app/services/email_service.py`

Agregar función para notificar cuando se extiende la fecha:

```python
async def send_fecha_extendida_notification(
    db: Session,
    project_title: str,
    project_id: int,
    old_due_date: datetime,
    new_due_date: datetime,
    author_name: str,
    justificacion: str,
) -> None:
    """
    Notifica por email cuando se extiende la fecha de un proyecto.
    Envía al notification_email configurado.
    """
    config = get_smtp_config(db)
    if not config:
        return

    old_str = old_due_date.strftime("%Y-%m-%d") if old_due_date else "No definida"
    new_str = new_due_date.strftime("%Y-%m-%d")

    subject = f"📅 Fecha extendida: {project_title}"
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #E31E24;">Extensión de Fecha de Proyecto</h2>
        <p><strong>Proyecto:</strong> {project_title} (ID #{project_id})</p>
        <p><strong>Extendido por:</strong> {author_name}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Fecha anterior</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">{old_str}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Nueva fecha</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #E31E24; font-weight: bold;">{new_str}</td>
            </tr>
        </table>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px;
                    border-left: 4px solid #E31E24; margin: 16px 0;">
            <p style="margin: 0; font-weight: bold;">Justificación:</p>
            <p style="margin: 8px 0 0 0;">{justificacion}</p>
        </div>
        <hr style="border-color: #eee;" />
        <p style="color: #999; font-size: 12px;">
            Notificación automática — Matriz ZYMO
        </p>
    </div>
    """
    await send_email(db, config.notification_email, subject, body)
```

---

## FASE 3 — Backend: Route nueva

### 3.1 — Endpoint para extender fecha por propietario

**Archivo a modificar:** `backend/app/routes/projects.py`

Agregar nuevo endpoint (después del endpoint existente de due-date, líneas 577-603):

```python
@router.patch("/{project_id}/extender-fecha", response_model=ProjectRead)
async def extender_fecha_proyecto(
    project_id: int,
    payload: DueDateExtendInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Usuario o coordinador pueden extender la fecha de sus propios proyectos.
    Requiere justificación (mínimo 10 caracteres).
    Crea un comentario de tipo 'extension_fecha' con la justificación.
    """
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")

    # Verificar propiedad del proyecto
    # Usuario: solo puede extender sus propios proyectos
    # Coordinador: puede extender sus propios proyectos
    if current_user.role == "usuario" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo puedes modificar la fecha de tus propios proyectos.")

    if current_user.role == "coordinador" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo puedes modificar la fecha de tus propios proyectos.")

    # Validar justificación
    if not payload.justificacion or len(payload.justificacion.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="La justificación debe tener al menos 10 caracteres."
        )

    # Guardar fecha anterior para el comentario
    old_due_date = project.due_date

    # Parsear nueva fecha
    try:
        from datetime import date as _date
        parsed = datetime.combine(
            _date.fromisoformat(payload.due_date),
            datetime.min.time(),
            tzinfo=timezone.utc,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD.")

    # Validar que la nueva fecha sea posterior a la actual
    if project.due_date and parsed <= project.due_date:
        raise HTTPException(
            status_code=400,
            detail="La nueva fecha debe ser posterior a la fecha actual."
        )

    # Actualizar fecha
    project.due_date = parsed
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)

    # Crear comentario de tipo extension_fecha
    from app.schemas.comment import CommentCreate
    justificacion_texto = payload.justificacion.strip()
    old_str = old_due_date.strftime("%Y-%m-%d") if old_due_date else "No definida"
    new_str = parsed.strftime("%Y-%m-%d")

    comment_msg = (
        f"Fecha de vencimiento extendida de {old_str} a {new_str}. "
        f"Justificación: {justificacion_texto}"
    )
    sc = create_status_comment(
        db, project_id, current_user,
        comment_msg,
        tipo="extension_fecha",
    )

    # Broadcasts
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_id, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.fecha_extendida", {
        "id": project_id,
        "due_date": parsed.isoformat(),
    })

    # Notificar por email (fire and forget)
    from app.services.email_service import send_fecha_extendida_notification
    try:
        asyncio.create_task(
            send_fecha_extendida_notification(
                db=db,
                project_title=project.title,
                project_id=project_id,
                old_due_date=old_due_date,
                new_due_date=parsed,
                author_name=current_user.full_name or current_user.email,
                justificacion=justificacion_texto,
            )
        )
    except Exception:
        pass  # No bloquea la respuesta si falla el email

    return _read_with_evidence_count(db, project)
```

### 3.2 — Actualizar create_status_comment para aceptar tipo

**Archivo a modificar:** `backend/app/services/comment_service.py`

Verificar que `create_status_comment` acepte el parámetro `tipo`. Si no lo tiene, agregarlo:

```python
def create_status_comment(
    db: Session,
    project_id: int,
    author: User,
    message: str,
    tipo: str = "cambio_estado",  # Agregar parámetro opcional
) -> ProjectComment:
```

---

## FASE 4 — Frontend: Tipos

### 4.1 — Agregar tipo de comentario

**Archivo a modificar:** `frontend/src/types/comment.ts`

```typescript
tipo: "comentario" | "cambio_estado" | "feedback" | "aprobacion" | "actualizacion" | "extension_fecha"
```

### 4.2 — Agregar tipo para extensión de fecha

**Archivo a modificar:** `frontend/src/types/project.ts`

```typescript
export interface DueDateExtendPayload {
  due_date: string  // YYYY-MM-DD
  justificacion: string
}
```

---

## FASE 5 — Frontend: Hook

### 5.1 — Agregar función al hook de proyectos

**Archivo a modificar:** `frontend/src/hooks/useProjectActions.ts`

Agregar nueva función:

```typescript
import type { DueDateExtendPayload } from "@/types/project"

// Agregar al hook:
async function extenderFecha(
  projectId: number,
  payload: DueDateExtendPayload
): Promise<Project | null> {
  return exec(async () => {
    const { data } = await api.patch<Project>(
      `/projects/${projectId}/extender-fecha`,
      payload
    )
    _updateLocal(data)
    return data
  })
}

// Agregar a return:
return {
  // ... otros métodos
  extenderFecha,
}
```

---

## FASE 6 — Frontend: Componente UI

### 6.1 — Agregar botón de editar fecha en ProjectDetail

**Archivo a modificar:** `frontend/src/pages/ProjectDetailShowcasePage.tsx`

1. Importar la función `isUsuario`, `isCoordinador` del módulo `roles`
2. Agregar un pequeño botón o icono de "editar fecha" junto a la muestra de la fecha de vencimiento
3. Al hacer clic, mostrar un **modal/dialog** con:
   - Selector de fecha (calendar picker)
   - Campo de texto para justificación (textarea)
   - Botón "Guardar" con validación (mínimo 10 caracteres)
   - Mostrar la fecha actual

**Lógica de visibilidad del botón:**
- Solo mostrar si el usuario actual es el owner del proyecto (`project.owner_id === currentUser.id`)
- Solo mostrar si el rol es `usuario` o `coordinador`
- NO mostrar si ya está en estado `rechazado` o `aprobado_final` (opcional, según negocio)

### 6.2 — Componente de diálogo para extender fecha

Se puede crear un nuevo componente o integrar inline. Incluir:
- Input de fecha (puede usar el nativo `<input type="date">` o un componente de calendar)
- Textarea para justificación con contador de caracteres
- Validación en tiempo real (mostrar error si < 10 caracteres)
- Loading state durante la llamada API

---

## FASE 7 — Verificación

### Checklist a ejecutar:

**Backend:**
- [ ] `python -c "from app.schemas.project import DueDateExtendInput; print('OK')"` — sin errores
- [ ] Arrancar con `uvicorn app.main:app --reload` — sin errores
- [ ] `PATCH /projects/{id}/extender-fecha` con token de usuario retorna 403 si no es owner
- [ ] `PATCH /projects/{id}/extender-fecha` con token de coordinador retorna 403 si no es owner
- [ ] `PATCH /projects/{id}/extender-fecha` con token de usuario-owner retorna 200 y crea comentario tipo `extension_fecha`
- [ ] `PATCH /projects/{id}/extender-fecha` con justificación < 10 caracteres retorna 400
- [ ] `PATCH /projects/{id}/extender-fecha` con fecha anterior a la actual retorna 400

**Frontend:**
- [ ] `pnpm build` (o `npm run build`) sin errores TypeScript
- [ ] El botón de editar fecha aparece solo para usuario/coordinador que son owners
- [ ] El modal valida que la justificación tenga al menos 10 caracteres
- [ ] Al guardar, el proyecto se actualiza en la lista y muestra la nueva fecha
- [ ] El comentario de extensión aparece en el chat del proyecto

---

## NOTAS IMPORTANTES PARA EL AGENTE

1. **No eliminar el endpoint original** `PATCH /projects/{id}/due-date` — los admin/superadmin siguen pudiendo usarlo (para uso interno/admin).

2. **El nuevo endpoint requiere justificación** — no se puede cambiar la fecha sin explicar por qué.

3. **La justificación se almacena en un comentario** — visible para todos en el chat del proyecto.

4. **El email de notificación se envía al notification_email** — mismo que se usa para otras notificaciones.

5. **Orden de ejecución:** Fase 1 → 2 → 3 → 4 → 5 → 6 → 7. No saltes fases.

6. **Antes de empezar a codificar, lee `rules.md`** — tiene las convenciones del proyecto.