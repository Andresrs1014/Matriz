# Plan: Cargue de evidencias en proyectos / OKR

> **Estado:** propuesta — pendiente de confirmación del usuario antes de tocar código.
> **Fecha:** 2026-05-05
> **Owner técnico:** Andrés Quintero
> **Aplica a:** `backend/app/*`, `frontend/src/*`, `docker-compose.yml`

---

## 1. Objetivo

Permitir adjuntar **evidencia** (Excel, PDF, fotos, documentos de texto, hasta **10 MB**) a un proyecto / OKR en dos momentos:

1. **Al crear un nuevo proyecto** desde el modal `Subir OKR / Proyecto` (`ProjectSubmitForm`), accionado tanto desde `ProjectsPage` (admin / superadmin / coordinador) como desde `UserProjectsPage` (usuario final).
2. **Dentro del detalle del proyecto** (`ProjectDetailShowcasePage`), donde cualquier persona con acceso al proyecto pueda **subir evidencia de los avances** mientras el proyecto está vivo.

El cargue debe ser:

- Seguro (validación servidor + cliente, sin bypass).
- Trazable (quién subió, cuándo, qué archivo, sobre qué proyecto).
- Compatible con el flujo de roles existente (`usuario → coordinador → admin → superadmin`).
- Desplegable en Docker sin cambios manuales en producción.
- Retrocompatible con la base de datos SQLite actual (migración aditiva, sin destructivas).

---

## 2. Alcance

### En alcance
- Modelo y endpoints REST para `ProjectEvidence`.
- Almacenamiento físico de archivos en disco persistente del contenedor backend.
- UI de carga, listado, descarga y borrado en el form de creación y en el detalle.
- Validación de tipo MIME, extensión, tamaño y permisos.
- Auditoría mínima vía logs y comentario de estado.

### Fuera de alcance (no se hará en esta tanda)
- Antivirus en línea (ClamAV) — se deja registrado como mejora futura.
- Versionamiento de evidencias (overwrite: cada upload es una nueva fila).
- Vista previa/render embebido de PDFs o imágenes — solo descarga y miniatura para imágenes.
- Migrar el almacenamiento a S3 / Azure Blob — el contrato del API se diseña neutro para que esa migración sea trivial luego.

---

## 3. Reglas de negocio

### 3.1 Tipos de archivo permitidos (whitelist)

| Categoría | Extensiones | MIME |
|-----------|-------------|------|
| Excel | `.xlsx`, `.xls`, `.csv` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv` |
| PDF | `.pdf` | `application/pdf` |
| Fotos | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Texto / Word | `.txt`, `.doc`, `.docx`, `.rtf`, `.md` | `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/rtf`, `text/markdown` |

- **Bloqueado siempre:** `.exe`, `.js`, `.sh`, `.bat`, `.ps1`, `.html`, `.svg`, archivos sin extensión, dobles extensiones (`x.pdf.exe`).
- Validación cruzada: si la extensión y el MIME declarado no se corresponden con el whitelist → 415.

### 3.2 Límite de tamaño
- **10 MB** por archivo (`MAX_EVIDENCE_BYTES = 10 * 1024 * 1024`).
- Validación en frontend (UX inmediato) **y** en backend (autoritativo).

### 3.3 Cuántos archivos
- Máximo **20 evidencias activas por proyecto** (configurable, evitar abuso de disco).
- En un mismo upload del modal de creación se permite multi-select hasta 5 archivos.

### 3.4 Permisos

| Acción | Usuario | Coordinador | Admin | Superadmin |
|--------|---------|-------------|-------|------------|
| Subir evidencia a proyecto **propio** | ✅ (siempre que el proyecto no esté `rechazado`) | ✅ | ✅ | ✅ |
| Subir evidencia a proyecto **de otro** | ❌ | ✅ | ✅ | ✅ |
| Listar evidencias de un proyecto al que ya tiene acceso | ✅ | ✅ | ✅ | ✅ |
| Descargar evidencia | igual que listar | igual | igual | igual |
| Borrar evidencia que **subió él mismo** | ✅ | ✅ | ✅ | ✅ |
| Borrar evidencia de **otro autor** | ❌ | ❌ | ✅ | ✅ |

> Reutilizar `get_current_user`, `require_admin`, `require_superadmin` de `core/dependencies.py`.
> En frontend usar helpers existentes en `lib/roles.ts` y un helper nuevo `canDeleteEvidence(user, evidence)`.

### 3.5 Estados de proyecto
- Se permite cargar evidencia en **todos los estados excepto `rechazado`**.
- En `aprobado_final` se puede seguir cargando evidencia para auditoría posterior.

---

## 4. Diseño backend

### 4.1 Modelo `ProjectEvidence`

Archivo nuevo: `backend/app/models/evidence.py`.

Campos (SQLModel, tabla `projectevidence`):

```
id              int PK
project_id      int FK → project.id (index=True, NOT NULL)
uploaded_by     int FK → user.id    (NOT NULL)
uploader_name   str (snapshot, max 200)
uploader_role   str (snapshot, max 50)
filename        str (nombre original sanitizado, max 255)
storage_path    str (ruta relativa dentro de /app/data/evidence, max 500)
mime_type       str (max 120)
extension       str (max 16, sin punto, lowercase)
size_bytes      int (NOT NULL)
sha256          str (64) — hash del contenido para deduplicación / integridad
description     str opcional (max 500) — comentario del usuario al subir
created_at      datetime (UTC)
deleted_at      datetime opcional (soft delete; null = activo)
```

Reglas:
- Soft delete (`deleted_at`) para no perder trazabilidad. Las queries de listado filtran por `deleted_at IS NULL`.
- `storage_path` se calcula servidor-side: `evidence/{project_id}/{uuid4}.{ext}`. **Nunca** se confía en el nombre que envía el cliente.
- Registrar en `__init__.py` de `models` y migrar en `database.py`.

### 4.2 Migración aditiva

En `database.py::run_migrations()` añadir bloques `try/except` (idempotentes, igual al patrón existente):

```
ALTER TABLE projectevidence ADD COLUMN ...   ← NO aplica, es tabla nueva
```

Como es **tabla nueva**, basta con `SQLModel.metadata.create_all(engine)` en `create_db_and_tables()`. No se requiere migración manual. **Tabla y columnas existentes no se tocan.**

### 4.3 Esquemas Pydantic

Archivo nuevo: `backend/app/schemas/evidence.py`.

```
EvidenceRead:
  id, project_id, uploaded_by, uploader_name, uploader_role,
  filename, mime_type, extension, size_bytes, description,
  created_at, download_url   # construido en el router

EvidenceUpdateInput:
  description: str | None
```

No hay `EvidenceCreate` Pydantic porque el upload es `multipart/form-data`, no JSON.

### 4.4 Servicio de negocio

Archivo nuevo: `backend/app/services/evidence_service.py`. Responsabilidades:

1. `validate_upload(file, declared_mime) -> tuple[ext, mime]` — whitelist + tamaño + sniffing básico de magic bytes (cabecera) para mitigar `Content-Type` falsificado.
2. `save_to_disk(project_id, file_obj) -> (storage_path, size_bytes, sha256)` — escribe en `EVIDENCE_DIR/{project_id}/` con nombre uuid, calculando hash en streaming.
3. `assert_can_upload(user, project)` — usa `lib/roles` reglas de 3.4.
4. `assert_can_delete(user, evidence)` — autor o admin+.
5. `list_active_evidences(db, project_id) -> list[ProjectEvidence]`.
6. `soft_delete(db, evidence)`.

> Toda la lógica de filesystem vive en este servicio. Routers no tocan disco.

### 4.5 Configuración

`backend/app/config.py` añadir:

```
evidence_dir: str = "./data/evidence"
max_evidence_mb: int = 10
max_evidence_per_project: int = 20
```

(Se leen de `.env` si existen; defaults son los seguros.)

`.env.example` documentar las nuevas variables.

### 4.6 Endpoints REST

Archivo nuevo: `backend/app/routes/evidence.py`. Todas las rutas con prefix `/projects/{project_id}/evidence`.

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `` | `get_current_user` | Lista evidencias activas del proyecto (si tiene acceso al proyecto). |
| `POST` | `` | `get_current_user` | Sube **un** archivo. `multipart/form-data` con `file` + `description?`. Devuelve `EvidenceRead`. |
| `GET` | `/{evidence_id}/download` | `get_current_user` | Devuelve `FileResponse` con `Content-Disposition: attachment; filename="…"`. |
| `PATCH` | `/{evidence_id}` | autor o admin+ | Edita solo `description`. |
| `DELETE` | `/{evidence_id}` | autor o admin+ | Soft delete. |

Detalles:
- Registrar el router en `main.py`.
- Emitir evento WS `project.evidence_added` y `project.evidence_removed` para refresco en vivo (consume `core/ws_manager`).
- Crear comentario de estado opcional cuando se sube evidencia: `"<nombre> adjuntó evidencia: <filename>."` — útil en el chat del proyecto.
- Logs: `logger.info("[evidence] uploaded ...")`, `logger.warning("[evidence] rejected: <razón>")` — sin loggear contenido del archivo.

### 4.7 Almacenamiento físico

- Path absoluto dentro del contenedor: `/app/data/evidence/{project_id}/{uuid}.{ext}`.
- Se monta sobre el volumen **ya existente** `sqlite_data` (que mapea `/app/data`). No se crea volumen nuevo → cero cambio en `docker-compose.yml`.
- Permisos: el directorio se crea con `Path(...).mkdir(parents=True, exist_ok=True)` en arranque (similar al patrón actual de SQLite).
- Limpieza en hard-delete del proyecto: cuando `delete_project` borra un proyecto, hacer hard-delete recursivo del directorio `evidence/{project_id}/` (extender `project_service.delete_project`).

### 4.8 Seguridad

- Sanitización del filename original con whitelist (alfa, números, espacio, guion, punto). Truncar a 120 caracteres.
- **Nunca** servir el archivo desde la URL pública por path original; siempre vía endpoint autenticado.
- `Content-Disposition: attachment` (forzar descarga) para evitar XSS por archivos HTML/SVG (que igual están bloqueados por whitelist).
- `Content-Type` de respuesta = mime guardado, no el que envía el cliente al descargar.
- Validar `project_id` de la URL contra el `project_id` del registro de evidencia → 404 si no coinciden.
- Tamaño verificado al **escribir** al disco vía streaming (no sólo al inicio): si excede el límite mientras se está escribiendo → abortar, borrar parcial, 413.
- Hash sha256 calculado en streaming sirve como integrity check y permite deduplicación opcional posterior.
- Rate limiting básico futuro (no en este sprint, dejarlo como TODO en `docs/`).

---

## 5. Diseño frontend

### 5.1 Tipos y API client

Nuevo: `frontend/src/types/evidence.ts`.

```
EvidenceRead { ... mismos campos que el schema }
```

Nuevo: `frontend/src/hooks/useEvidence.ts` — encapsula:
- `listEvidence(projectId)`
- `uploadEvidence(projectId, file, description)` con `FormData`
- `deleteEvidence(projectId, evidenceId)`
- `downloadEvidence(projectId, evidenceId)` — abre la URL autenticada

> Toda lógica de API queda fuera de los componentes, según la regla de capas.

Nuevo: `frontend/src/lib/evidence.ts`:
- `EVIDENCE_ALLOWED_EXTS`
- `EVIDENCE_MAX_BYTES`
- `validateFile(file): { ok: true } | { ok: false, error: string }`
- `formatBytes(n)`
- `iconForExtension(ext)` (lucide: `FileSpreadsheet`, `FileText`, `Image`, `FileType`)

### 5.2 Componente reutilizable: `EvidenceUploader`

Ubicación: `frontend/src/components/projects/EvidenceUploader.tsx`. Modos:

```
<EvidenceUploader
  mode="pending"                    // archivos en memoria, aún no hay projectId
  files={localFiles} onChange={...}
/>

<EvidenceUploader
  mode="live"
  projectId={project.id}
  evidences={list}
  onChanged={refetch}
  canUpload={...}
  canDelete={(e) => ...}
/>
```

Características:
- Drag & drop + selector tradicional (`<input type="file" multiple>`).
- Validación inmediata (extensión + tamaño) con `sonner` toast en errores (regla: nunca `alert()`).
- Barra de progreso de upload (axios `onUploadProgress`).
- Vista de tarjetas con icono según extensión, nombre, peso, autor, fecha, descripción opcional, botón descargar y botón eliminar (cuando aplique).
- Miniatura para imágenes (`<img>` cargada con token vía endpoint de descarga; o usando `URL.createObjectURL` después de fetch; resolver detalle al implementar).
- Accesibilidad: labels visibles, foco en inputs, estados de loading/disabled.

Cumple regla de tamaño: si supera ~250 líneas, dividir en `EvidenceCard.tsx` + `EvidenceDropzone.tsx`.

### 5.3 Integración 1: en `ProjectSubmitForm`

Estrategia recomendada para no introducir un endpoint "create con multipart":

1. El usuario llena el form normal.
2. Adicional: nuevo bloque "Evidencias iniciales" que usa `EvidenceUploader` en `mode="pending"` (los archivos quedan en memoria del componente).
3. Al hacer submit:
   - `POST /projects` (igual que hoy) → recibe `project.id`.
   - Por cada archivo seleccionado: `POST /projects/{id}/evidence` (multipart), secuencial, con barra de progreso global.
   - Si alguna evidencia falla, se muestra toast pero el proyecto **ya quedó creado** (no se rollbackea). Mostrar resumen "X de Y evidencias se cargaron, Y-X fallaron — puedes volver a intentarlo desde el detalle del proyecto".
4. Solo al terminar todo se llama a `onSuccess()`.

> El borrador (`/drafts/me`) **no** persiste archivos, solo metadatos de OKR. Esto se documenta y queda fuera de alcance en este sprint.

### 5.4 Integración 2: en `ProjectDetailShowcasePage`

- Añadir una nueva **sección "Evidencias y avances"** en la columna principal del detalle, después de las "Detail sections" (después de `los 5 porqué` / `métodos de medición`) y antes del bloque ROI.
- Renderiza `<EvidenceUploader mode="live" .../>`.
- `canUpload` = `isOwner || isCoordinador(user) || isAdmin(user)` y `project.status !== "rechazado"`.
- `canDelete(evidence)` = `evidence.uploaded_by === user.id || isAdmin(user)`.
- Reaccionar al evento WS `project.evidence_added` / `project.evidence_removed` para refrescar la lista en vivo (igual al patrón de comentarios).

### 5.5 Integración 3: en `ProjectsPage` (admin) y `UserProjectsPage`

- En la tarjeta del proyecto, agregar un badge discreto: ícono 📎 con el contador de evidencias (`project.evidence_count`). Esto **requiere** que `ProjectRead` exponga un `evidence_count: int`. Cambio mínimo retrocompatible (campo opcional con default `0`).
- Al hacer click en el badge, navegar al detalle scrolleando a la sección de evidencias (`#evidencias`).

> Si se considera que `evidence_count` complica el endpoint, se puede dejar para una segunda iteración y consultar lazy desde el detalle.

---

## 6. Cambios concretos por archivo (resumen)

### Backend (nuevos)
- `backend/app/models/evidence.py`
- `backend/app/schemas/evidence.py`
- `backend/app/services/evidence_service.py`
- `backend/app/routes/evidence.py`

### Backend (modificados)
- `backend/app/models/__init__.py` → exportar `ProjectEvidence`.
- `backend/app/main.py` → `include_router(evidence_router)`.
- `backend/app/config.py` → variables de configuración.
- `backend/app/database.py` → asegurar creación del directorio `evidence/` en arranque (mismo patrón que SQLite).
- `backend/app/services/project_service.py` → en `delete_project`, borrar también el directorio físico de evidencias.
- `backend/app/schemas/project.py` → agregar opcional `evidence_count: int = 0` en `ProjectRead` (no rompe nada).
- `backend/app/routes/projects.py` → llenar `evidence_count` en `_to_read` (con `count(*)` o `len(...)`; cuidar N+1).
- `backend/.env.example` → documentar nuevas variables.
- `backend/requirements.txt` → ya incluye `python-multipart`. **Sin nuevas dependencias.**

### Frontend (nuevos)
- `frontend/src/types/evidence.ts`
- `frontend/src/hooks/useEvidence.ts`
- `frontend/src/lib/evidence.ts`
- `frontend/src/components/projects/EvidenceUploader.tsx`
- `frontend/src/components/projects/EvidenceCard.tsx`
- `frontend/src/components/projects/EvidenceDropzone.tsx`

### Frontend (modificados)
- `frontend/src/components/projects/ProjectSubmitForm.tsx` → bloque "Evidencias iniciales" + envío post-create.
- `frontend/src/pages/ProjectDetailShowcasePage.tsx` → nueva sección "Evidencias y avances".
- `frontend/src/pages/ProjectsPage.tsx` → badge contador.
- `frontend/src/pages/UserProjectsPage.tsx` → badge contador.
- `frontend/src/types/project.ts` → campo opcional `evidence_count?: number`.
- `frontend/src/lib/roles.ts` → helpers `canUploadEvidence`, `canDeleteEvidence`.
- `frontend/src/lib/api.ts` → **sin cambios** (axios ya soporta `FormData`).
- `frontend/src/store/...` → si se quiere reaccionar a WS, crear `evidenceEventStore.ts` similar a `commentEventStore.ts`. Opcional.

### Infra
- `docker-compose.yml` → **sin cambios**. El volumen `sqlite_data:/app/data` ya cubre `/app/data/evidence/`.
- Si en el futuro se quiere separar, basta añadir `evidence_data:/app/data/evidence` sin migración compleja.

---

## 7. Plan de validación / pruebas manuales

Cada bloque debe pasar **antes** de dar la feature por terminada. Documentar resultados en una tabla cuando se ejecute.

### 7.1 Backend
1. `docker compose up --build` arranca sin errores y `/health` responde.
2. `GET /projects/{id}/evidence` con token de usuario que **no es dueño y no es coord/admin** → `403`.
3. `POST /projects/{id}/evidence` con archivo `.exe` → `415`.
4. `POST` con `.pdf` de 11 MB → `413`.
5. `POST` con `.pdf` de 9 MB → `201`, archivo aparece en `/app/data/evidence/{id}/`, `sha256` en BD.
6. `GET /download` retorna el archivo con `Content-Disposition: attachment` y `Content-Type` correcto.
7. `DELETE` por autor → soft delete, ya no aparece en `GET ""`, archivo físico **se conserva** (auditoría).
8. `DELETE` por admin sobre evidencia ajena → ok.
9. `DELETE` por usuario sobre evidencia ajena → `403`.
10. `delete_project` elimina el directorio físico.
11. WebSocket emite `project.evidence_added` al crear y `project.evidence_removed` al borrar.
12. Migración: levantar contra una BD `matrix.db` existente y comprobar que **no rompe** nada (tabla nueva se crea, tablas viejas intactas).

### 7.2 Frontend
1. Modal "Subir OKR / Proyecto" muestra zona de evidencias; permite arrastrar 3 archivos válidos.
2. Subir un `.bat` se rechaza con toast antes de tocar el backend.
3. Subir un PDF de 12 MB se rechaza con toast antes de tocar el backend.
4. Crear proyecto con 2 evidencias → ambas aparecen en el detalle, en la sección "Evidencias y avances".
5. Como **usuario** dueño del proyecto: puede subir evidencia de avance, ver lista, descargar y borrar las **suyas**, no las de otros.
6. Como **coordinador**: puede subir y descargar en cualquier proyecto al que tenga acceso, no puede borrar evidencias ajenas.
7. Como **admin**: borra evidencias ajenas; aparece toast confirmando.
8. WS: con dos sesiones abiertas, al subir una evidencia en una pestaña, la otra se actualiza en vivo.
9. Descarga de imagen: se obtiene archivo binario íntegro (comparar sha256 vs el guardado).
10. Lista en `ProjectsPage` muestra el badge `📎 N` con el número correcto.
11. Borrar el proyecto (admin) elimina sus evidencias del listado y del filesystem.

### 7.3 Seguridad / regresión
- Recorrido de path: subir un archivo con `..\..\evil.pdf` como nombre → el `storage_path` queda saneado, no escapa de `evidence/{id}/`.
- `Content-Type` falso (`.exe` renombrado a `.pdf`): backend rechaza por magic-bytes mismatch.
- Token expirado durante upload → 401, frontend invoca el flujo del interceptor.
- CORS: con `ENV=production` y `CORS_ORIGINS=http://localhost`, el upload sigue funcionando desde el dominio configurado.
- Logs no contienen el contenido del archivo, solo metadata.
- `SECRET_KEY`, `WEBHOOK_SECRET` no se loguean ni se exponen.
- `docker compose up --build` desde cero (sin volumen) crea `data/` y `data/evidence/` correctamente.
- `docker compose down` y `up` mantienen las evidencias (volumen persistido).

---

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Disco del servidor se llena con archivos grandes | Caída del backend | Límite por archivo (10 MB) + máx 20 por proyecto + alerta en logs si `df` < 10 % (futuro). |
| Subida de archivo malicioso (XSS via SVG/HTML) | Compromiso del navegador | Whitelist estricto + `Content-Disposition: attachment` siempre. SVG bloqueado. |
| Path traversal por nombre original | Lectura/escritura fuera del dir | `storage_path` se genera con UUID; nombre original solo se guarda en BD para mostrar. |
| Volumen `sqlite_data` mezclando DB y archivos | Backups confusos | Se documenta en `docs/` que `data/evidence/` puede separarse a un volumen propio en el futuro sin migración compleja. |
| Carga lenta de 5 archivos grandes seguidos en la creación | Mala UX | Subida secuencial con progreso; el proyecto se crea **antes** de subir, así nunca queda el form bloqueado por una subida lenta. |
| Token JWT en URLs de descarga (no se usa, pero sí en query string) | Logs con tokens | Descargas siempre con header `Authorization`, nunca con `?token=...`. |

---

## 9. Definición de Done

Se considera terminado **solo si**:

- Todos los puntos de validación 7.1, 7.2 y 7.3 pasan en una corrida limpia.
- `docker compose up --build` funciona desde una BD vacía y desde la BD existente actual.
- No se introduce ningún `alert()` nuevo; los errores van por `sonner`.
- No se hardcodean rutas absolutas, secretos ni dominios.
- `lib/roles.ts` y `core/dependencies.py` siguen siendo el único lugar que decide permisos.
- Los archivos de UI nuevos no superan ~250 líneas (split aplicado donde aplique).
- `docs/` actualizado con: cómo se almacenan las evidencias, dónde está el volumen, cómo respaldar/restaurar, política de tipos permitidos.
- `.env.example` actualizado.
- `README.md` (raíz) actualizado con un párrafo corto sobre la nueva feature.

---

## 10. Confirmaciones requeridas antes de codificar

Por favor confirmar (✅ / ✏️) cada punto:

1. **Tipos permitidos** (sección 3.1) — ¿agrego o quito alguno? Por ejemplo, ¿se requiere `.pptx`, `.zip`, vídeos?
2. **10 MB por archivo** y **20 archivos por proyecto** — ¿valores correctos?
3. **Permisos** (sección 3.4) — ¿el coordinador puede subir a cualquier proyecto, o solo a los que ya tiene visibilidad por flujo? La propuesta actual es: "puede ver → puede subir".
4. **Soft delete vs hard delete** — propuesta es soft (`deleted_at`). ¿Se acepta?
5. **Reuso del volumen `sqlite_data`** vs crear `evidence_data` aparte. Propuesta: reusar para no tocar `docker-compose.yml`.
6. **Badge contador en cards** — ¿se incluye en este sprint o se difiere?
7. **Comentario automático en el chat** al subir evidencia — propuesta es sí, mensaje corto del tipo `"<usuario> adjuntó: <archivo>"`. ¿Se acepta?
8. **Borrador**: hoy `/drafts/me` solo guarda metadatos. Confirmar que **no** queremos persistir archivos en borrador (solo se suben tras crear el proyecto).

Una vez confirmados estos 8 puntos, paso a la implementación siguiendo el orden:

1. Backend modelo + migración + schemas + service.
2. Backend routes + WS + tests manuales con `curl` / Postman.
3. Frontend types + hook + componente reutilizable.
4. Integración en `ProjectSubmitForm`.
5. Integración en `ProjectDetailShowcasePage`.
6. Badge en listados (si se confirma 6).
7. Documentación (`docs/`, `README.md`, `.env.example`).
8. Validación end-to-end completa de la sección 7.
