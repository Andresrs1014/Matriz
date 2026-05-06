# backend/app/routes/evidence.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.core.ws_manager import ws_manager
from app.models.user import User
from app.models.project import Project
from app.models.evidence import ProjectEvidence
from app.schemas.evidence import EvidenceRead, EvidenceUpdateInput
from app.services.evidence_service import (
    validate_upload,
    assert_can_upload,
    assert_can_delete,
    list_active_evidences,
    create_evidence,
    soft_delete_evidence,
    update_description,
)
from app.services.comment_service import create_status_comment
from app.config import settings
import logging
from pathlib import Path

router = APIRouter(prefix="/projects/{project_id}/evidence", tags=["Evidence"])
logger = logging.getLogger("evidence")


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return project


def _check_access(project: Project, current_user: User) -> None:
    """Usuario solo puede ver evidencias de sus propios proyectos. Admin+ ve todo."""
    if current_user.role == "usuario" and project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este proyecto.")


def _to_evidence_read(ev: ProjectEvidence, project_id: int) -> EvidenceRead:
    assert ev.id is not None
    return EvidenceRead(
        id=ev.id,
        project_id=ev.project_id,
        uploaded_by=ev.uploaded_by,
        uploader_name=ev.uploader_name,
        uploader_role=ev.uploader_role,
        filename=ev.filename,
        mime_type=ev.mime_type,
        extension=ev.extension,
        size_bytes=ev.size_bytes,
        sha256=ev.sha256,
        description=ev.description,
        created_at=ev.created_at,
        download_url=f"/projects/{project_id}/evidence/{ev.id}/download",
    )


@router.get("", response_model=list[EvidenceRead])
def list_evidences(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)
    evidences = list_active_evidences(db, project_id)
    return [_to_evidence_read(ev, project_id) for ev in evidences]


@router.post("", response_model=EvidenceRead, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    project_id: int,
    file: UploadFile = File(...),
    description: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)
    assert_can_upload(current_user, project)

    ext, mime = validate_upload(file, file.content_type)
    evidence = create_evidence(db, project_id, current_user, file, ext, mime, description)
    evidence.download_url = f"/projects/{project_id}/evidence/{evidence.id}/download"

    try:
        create_status_comment(
            db,
            project_id,
            current_user,
            f"{current_user.full_name or current_user.email} adjuntó evidencia: {evidence.filename}.",
        )
    except Exception:
        logger.warning("[evidence] no se pudo registrar comentario de estado", exc_info=True)

    logger.info(
        "[evidence] uploaded id=%s project=%s by=%s filename=%s size=%s",
        evidence.id, project_id, current_user.email, evidence.filename, evidence.size_bytes,
    )

    await ws_manager.broadcast("project.evidence_added", {
        "id": evidence.id,
        "project_id": evidence.project_id,
        "uploaded_by": evidence.uploaded_by,
        "uploader_name": evidence.uploader_name,
        "uploader_role": evidence.uploader_role,
        "filename": evidence.filename,
        "mime_type": evidence.mime_type,
        "extension": evidence.extension,
        "size_bytes": evidence.size_bytes,
        "sha256": evidence.sha256,
        "description": evidence.description,
        "created_at": evidence.created_at.isoformat(),
        "download_url": evidence.download_url,
    })

    return evidence


@router.get("/{evidence_id}/download")
def download_evidence(
    project_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)

    evidence = db.get(ProjectEvidence, evidence_id)
    if not evidence or evidence.project_id != project_id or evidence.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada.")

    file_path = Path(settings.evidence_dir) / evidence.storage_path
    return FileResponse(
        str(file_path),
        media_type=evidence.mime_type,
        filename=evidence.filename,
        content_disposition_type="attachment",
    )


@router.patch("/{evidence_id}", response_model=EvidenceRead)
def edit_evidence_description(
    project_id: int,
    evidence_id: int,
    payload: EvidenceUpdateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)

    evidence = db.get(ProjectEvidence, evidence_id)
    if not evidence or evidence.project_id != project_id or evidence.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada.")

    # Solo autor o admin+ puede editar descripción
    if evidence.uploaded_by != current_user.id and current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes editar esta evidencia.")

    evidence = update_description(db, evidence, payload.description)
    evidence.download_url = f"/projects/{project_id}/evidence/{evidence.id}/download"
    return evidence


@router.delete("/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    project_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)

    evidence = db.get(ProjectEvidence, evidence_id)
    if not evidence or evidence.project_id != project_id or evidence.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada.")

    assert_can_delete(current_user, evidence)

    soft_delete_evidence(db, evidence)
    logger.info(
        "[evidence] soft_deleted id=%s project=%s by=%s",
        evidence.id, project_id, current_user.email,
    )

    await ws_manager.broadcast("project.evidence_removed", {
        "id": evidence.id,
        "project_id": project_id,
    })
    return None
