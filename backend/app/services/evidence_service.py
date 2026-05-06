# backend/app/services/evidence_service.py
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import shutil
from uuid import uuid4
from fastapi import HTTPException, status, UploadFile
from sqlmodel import Session, select, func

from app.config import settings
from app.models.evidence import ProjectEvidence
from app.models.project import Project
from app.models.user import User


# ── Whitelist ─────────────────────────────────────────────────────────────────
_ALLOWED_EXTS: set[str] = {
    "xlsx", "xls", "csv",
    "pdf",
    "jpg", "jpeg", "png", "gif", "webp",
    "txt", "doc", "docx", "rtf", "md",
}

_EXTENSION_TO_MIME: dict[str, str] = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls":  "application/vnd.ms-excel",
    "csv":  "text/csv",
    "pdf":  "application/pdf",
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "png":  "image/png",
    "gif":  "image/gif",
    "webp": "image/webp",
    "txt":  "text/plain",
    "doc":  "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "rtf":  "application/rtf",
    "md":   "text/markdown",
}

_MAX_BYTES: int = settings.max_evidence_mb * 1024 * 1024
_MAX_PER_PROJECT: int = settings.max_evidence_per_project


def _sniff_mime_from_bytes(data: bytes) -> str | None:
    """Magic bytes básicos para PDF, imágenes y ZIP (Office)."""
    if data.startswith(b"%PDF"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if data[:4] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    # Office Open XML (xlsx, docx) son ZIP; legacy xls/doc no tienen magic bytes fiables sin lib externa
    if data[:4] == b"PK\x03\x04":
        # ZIP-based; puede ser xlsx o docx. Sin librería externa no diferenciamos,
        # así que confiamos en la extensión validada previamente.
        return "application/zip"
    return None


def _sanitize_filename(name: str) -> str:
    """Conserva alfanuméricos, espacio, guión, punto y underscore. Trunca a 120 chars."""
    allowed_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-_()")
    sanitized = "".join(c for c in name if c in allowed_chars).strip()
    return sanitized[:120]


def _evidence_dir_for_project(project_id: int) -> Path:
    return Path(settings.evidence_dir) / str(project_id)


# ── Validaciones ────────────────────────────────────────────────────────────────

def validate_upload(file: UploadFile, declared_mime: str | None = None) -> tuple[str, str]:
    """
    Valida archivo contra whitelist de extensión/MIME, tamaño, y magic bytes.
    Devuelve (extensión_sin_punto_lowercase, mime_validado).
    Raises HTTPException 415 o 413 si no pasa.
    """
    filename = file.filename or ""
    # Extraer extensión
    lower_name = filename.lower()
    # Bloquear dobles extensiones sospechosas (ej: x.pdf.exe)
    dangerous = {".exe", ".sh", ".bat", ".ps1", ".js", ".html", ".svg"}
    if any(ext in lower_name for ext in dangerous):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Tipo de archivo bloqueado.",
        )

    ext = Path(filename).suffix.lstrip(".").lower()
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="El archivo no tiene extensión.",
        )
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Extensión '.{ext}' no permitida.",
        )

    expected_mime = _EXTENSION_TO_MIME.get(ext)
    if expected_mime is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo MIME desconocido para extensión '.{ext}'.",
        )

    # Validar declared mime si fue enviado
    if declared_mime and declared_mime.lower() != expected_mime.lower():
        # Algunos navegadores envían application/octet-stream; lo aceptamos
        if declared_mime.lower() != "application/octet-stream":
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Content-Type declarado '{declared_mime}' no coincide con la extensión.",
            )

    # Validar tamaño preliminar por headers (no es definitivo)
    content_length = file.size
    if content_length is not None and content_length > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Archivo excede {_MAX_BYTES // (1024 * 1024)} MB.",
        )

    return ext, expected_mime


def assert_can_upload(user: User, project: Project) -> None:
    """
    Reglas de negocio para subir evidencia.
    - Usuario: solo a proyectos propios, y solo si no está rechazado.
    - Coordinador/Admin/Superadmin: a cualquier proyecto visible.
    """
    if project.status == "rechazado":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se puede subir evidencia a un proyecto rechazado.",
        )
    if user.role == "usuario" and project.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes subir evidencia a tus propios proyectos.",
        )


def assert_can_delete(user: User, evidence: ProjectEvidence) -> None:
    """Autor o admin/superadmin pueden borrar. Coordinador no borra evidencias ajenas."""
    if evidence.uploaded_by == user.id:
        return
    if user.role in ("admin", "superadmin"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No puedes eliminar esta evidencia.",
    )


# ── Queries ───────────────────────────────────────────────────────────────────

def list_active_evidences(db: Session, project_id: int) -> list[ProjectEvidence]:
    return list(db.exec(
        select(ProjectEvidence)
        .where(ProjectEvidence.project_id == project_id)
        .where(ProjectEvidence.deleted_at == None)  # noqa: E711
        .order_by(ProjectEvidence.created_at.desc())
    ).all())


def count_active_evidences(db: Session, project_id: int) -> int:
    return db.exec(
        select(func.count(ProjectEvidence.id))
        .where(ProjectEvidence.project_id == project_id)
        .where(ProjectEvidence.deleted_at == None)  # noqa: E711
    ).one()


def evidence_counts_by_project_ids(db: Session, project_ids: list[int]) -> dict[int, int]:
    """Una sola consulta para listados — evita N+1."""
    if not project_ids:
        return {}
    rows = db.exec(
        select(ProjectEvidence.project_id, func.count(ProjectEvidence.id))
        .where(ProjectEvidence.project_id.in_(project_ids))
        .where(ProjectEvidence.deleted_at == None)  # noqa: E711
        .group_by(ProjectEvidence.project_id)
    ).all()
    return {int(pid): int(c) for pid, c in rows}


# ── Persistencia ──────────────────────────────────────────────────────────────

def save_to_disk(project_id: int, file: UploadFile, ext: str) -> tuple[str, int, str]:
    """
    Escribe archivo en evidence_dir/{project_id}/{uuid}.{ext}.
    Calcula sha256 en streaming y aborta si se excede tamaño.
    Retorna (ruta_relativa, size_bytes, sha256_hex).
    """
    project_dir = _evidence_dir_for_project(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid4().hex
    rel_path = f"{project_id}/{file_id}.{ext}"
    dest = Path(settings.evidence_dir) / rel_path

    sha256 = hashlib.sha256()
    total = 0

    try:
        with open(dest, "wb") as out:
            while True:
                chunk = file.file.read(64 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > _MAX_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Archivo excede {_MAX_BYTES // (1024 * 1024)} MB mientras se escribía.",
                    )
                sha256.update(chunk)
                out.write(chunk)
    finally:
        file.file.close()

    if total == 0:
        if dest.exists():
            dest.unlink()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )

    # Validación post-escritura de magic bytes para tipos binarios
    if ext in ("pdf", "png", "jpg", "jpeg", "gif", "webp"):
        with open(dest, "rb") as f:
            header = f.read(16)
        sniffed = _sniff_mime_from_bytes(header)
        expected = _EXTENSION_TO_MIME.get(ext)
        if sniffed and sniffed != expected and sniffed != "application/zip":
            dest.unlink()
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="El contenido del archivo no coincide con su extensión.",
            )

    return rel_path, total, sha256.hexdigest()


def create_evidence(
    db: Session,
    project_id: int,
    uploader: User,
    file: UploadFile,
    ext: str,
    mime: str,
    description: str | None,
) -> ProjectEvidence:
    """Valida límites por proyecto, guarda en disco y crea registro en BD."""
    current_count = count_active_evidences(db, project_id)
    if current_count >= _MAX_PER_PROJECT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Límite de {_MAX_PER_PROJECT} evidencias por proyecto alcanzado.",
        )

    rel_path, size_bytes, sha256_hex = save_to_disk(project_id, file, ext)

    evidence = ProjectEvidence(
        project_id=project_id,
        uploaded_by=uploader.id,
        uploader_name=uploader.full_name or uploader.email,
        uploader_role=uploader.role,
        filename=_sanitize_filename(file.filename or "evidencia"),
        storage_path=rel_path,
        mime_type=mime,
        extension=ext,
        size_bytes=size_bytes,
        sha256=sha256_hex,
        description=description,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


def soft_delete_evidence(db: Session, evidence: ProjectEvidence) -> None:
    evidence.deleted_at = datetime.now(timezone.utc)
    db.add(evidence)
    db.commit()


def update_description(db: Session, evidence: ProjectEvidence, description: str | None) -> ProjectEvidence:
    evidence.description = description
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


# ── Limpieza proyecto ─────────────────────────────────────────────────────────

def delete_project_evidences(project_id: int) -> None:
    """Hard-delete físico del directorio de evidencias de un proyecto (al borrar proyecto)."""
    project_dir = _evidence_dir_for_project(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir, ignore_errors=True)
