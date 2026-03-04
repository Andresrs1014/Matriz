from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.project_service import (
    list_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectRead])
def get_my_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_projects(db, owner_email=current_user.email)


@router.post("", response_model=ProjectRead)
def create_my_project(payload: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    return create_project(db, owner_email=current_user.email, data=data)


@router.get("/{project_id}", response_model=ProjectRead)
def get_my_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_project(db, project_id=project_id, owner_email=current_user.email)


@router.put("/{project_id}", response_model=ProjectRead)
def update_my_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project(db, project_id=project_id, owner_email=current_user.email)
    data = payload.model_dump(exclude_unset=True)
    return update_project(db, project, data)


@router.delete("/{project_id}")
def delete_my_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = get_project(db, project_id=project_id, owner_email=current_user.email)
    delete_project(db, project)
    return {"ok": True}
