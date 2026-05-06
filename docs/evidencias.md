# Evidencias adjuntas a proyectos

## Almacenamiento

- Los archivos se guardan bajo el directorio configurado en `EVIDENCE_DIR` (por defecto `./data/evidence`, en Docker `/app/data/evidence`).
- Comparten el volumen `sqlite_data` montado en `/app/data` del servicio backend (`docker-compose.yml`).
- Cada proyecto tiene carpeta `{evidence_dir}/{project_id}/` con nombres `{uuid}.{ext}` generados en servidor. El nombre mostrado al usuario es el original sanitizado en base de datos.

## Política

- Tamaño máximo por archivo: `MAX_EVIDENCE_MB` (default 10).
- Máximo de evidencias activas por proyecto: `MAX_EVIDENCE_PER_PROJECT` (default 20).
- Tipos permitidos: ver whitelist en `backend/app/services/evidence_service.py` y `frontend/src/lib/evidence.ts`.
- El borrado de una evidencia es **lógico** (`deleted_at`); el archivo en disco se conserva para auditoría salvo cuando se elimina el proyecto completo (entonces se borra el directorio del proyecto).

## Backups

- Incluir `/app/data/matrix.db` y `/app/data/evidence/` en copias de seguridad del volumen.
- Restaurar ambos conjuntamente para mantener consistencia entre metadatos y archivos.

## Mejoras pendientes (no bloqueantes)

- Rate limiting dedicado en endpoints de subida (`POST /projects/{id}/evidence`) — seguir política global del API.
