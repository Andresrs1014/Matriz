from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, col

from app.core.dependencies import get_db, get_current_user
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead
from app.core.ws_manager import ws_manager

router = APIRouter(prefix="/projects", tags=["Projects"])


def _to_read(p: Project) -> ProjectRead:
    assert p.id is not None
    return ProjectRead(
        id=p.id,
        title=p.title,
        description=p.description,
        status=p.status,
        source=p.source,
        owner_id=p.owner_id,
        ms_list_id=p.ms_list_id,
        updated_at=p.updated_at,
        created_at=p.created_at,
    )


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in ("admin", "superadmin"):
        projects = db.exec(select(Project).order_by(col(Project.created_at).desc())).all()
    else:
        projects = db.exec(
            select(Project)
            .where(Project.owner_id == current_user.id)
            .order_by(col(Project.created_at).desc())
        ).all()
    return [_to_read(p) for p in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assert current_user.id is not None
    project = Project(
        title=payload.title,
        description=payload.description,
        owner_id=current_user.id,
        source="manual",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # ✅ async def permite await directo — sin asyncio.create_task
    await ws_manager.broadcast(
        event_type="project.created",
        payload={"id": project.id, "title": project.title},
    )

    return _to_read(project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")
    return _to_read(project)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")
    db.delete(project)
    db.commit()
    return {"ok": True}
