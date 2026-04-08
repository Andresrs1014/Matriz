# backend/app/routes/drafts.py
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.draft import ProjectDraft

router = APIRouter(prefix="/drafts", tags=["Drafts"])


class DraftPayload(BaseModel):
    title: Optional[str] = None
    okr_objectives: Optional[str] = None
    key_results: Optional[str] = None
    key_actions: Optional[str] = None
    resources: Optional[str] = None
    five_whys: Optional[str] = None
    measurement_methods: Optional[str] = None
    okr_creator: Optional[str] = None
    collaborators: list[str] = []


class DraftRead(BaseModel):
    id: int
    title: Optional[str]
    okr_objectives: Optional[str]
    key_results: Optional[str]
    key_actions: Optional[str]
    resources: Optional[str]
    five_whys: Optional[str]
    measurement_methods: Optional[str]
    okr_creator: Optional[str]
    collaborators: list[str]
    updated_at: datetime
    model_config = {"from_attributes": True}


def _to_read(d: ProjectDraft) -> DraftRead:
    collabs: list[str] = []
    if d.collaborators_json:
        try:
            collabs = json.loads(d.collaborators_json)
        except Exception:
            collabs = []
    return DraftRead(
        id=d.id,  # type: ignore[arg-type]
        title=d.title,
        okr_objectives=d.okr_objectives,
        key_results=d.key_results,
        key_actions=d.key_actions,
        resources=d.resources,
        five_whys=d.five_whys,
        measurement_methods=d.measurement_methods,
        okr_creator=d.okr_creator,
        collaborators=collabs,
        updated_at=d.updated_at,
    )


@router.get("/me", response_model=Optional[DraftRead])
def get_my_draft(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve el borrador activo del usuario, o null si no tiene."""
    draft = db.exec(
        select(ProjectDraft).where(ProjectDraft.owner_id == current_user.id)
    ).first()
    if not draft:
        return None
    return _to_read(draft)


@router.put("/me", response_model=DraftRead)
def save_my_draft(
    payload: DraftPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea o actualiza el borrador del usuario (upsert)."""
    assert current_user.id is not None
    draft = db.exec(
        select(ProjectDraft).where(ProjectDraft.owner_id == current_user.id)
    ).first()

    collabs_json = json.dumps(payload.collaborators, ensure_ascii=False)

    if draft is None:
        draft = ProjectDraft(
            owner_id=current_user.id,
            title=payload.title,
            okr_objectives=payload.okr_objectives,
            key_results=payload.key_results,
            key_actions=payload.key_actions,
            resources=payload.resources,
            five_whys=payload.five_whys,
            measurement_methods=payload.measurement_methods,
            okr_creator=payload.okr_creator,
            collaborators_json=collabs_json,
            updated_at=datetime.now(timezone.utc),
        )
    else:
        draft.title = payload.title
        draft.okr_objectives = payload.okr_objectives
        draft.key_results = payload.key_results
        draft.key_actions = payload.key_actions
        draft.resources = payload.resources
        draft.five_whys = payload.five_whys
        draft.measurement_methods = payload.measurement_methods
        draft.okr_creator = payload.okr_creator
        draft.collaborators_json = collabs_json
        draft.updated_at = datetime.now(timezone.utc)

    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _to_read(draft)


@router.delete("/me", status_code=204)
def delete_my_draft(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Elimina el borrador del usuario."""
    draft = db.exec(
        select(ProjectDraft).where(ProjectDraft.owner_id == current_user.id)
    ).first()
    if draft:
        db.delete(draft)
        db.commit()
