from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select, col

from app.models.project import Project


def list_projects(db: Session, owner_id: int) -> list[Project]:
    statement = select(Project).where(Project.owner_id == owner_id).order_by(col(Project.updated_at).desc())
    return list(db.exec(statement))


def get_project(db: Session, project_id: int, owner_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project or project.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return project


def create_project(db: Session, owner_id: int, data: dict) -> Project:
    project = Project(owner_id=owner_id, **data)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project: Project, data: dict) -> Project:
    for k, v in data.items():
        setattr(project, k, v)
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()
