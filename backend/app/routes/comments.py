from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.project import Project
from app.schemas.comment import CommentCreate, CommentRead
from app.services.comment_service import create_comment, get_comments

router = APIRouter(prefix="/projects/{project_id}/comments", tags=["Comments"])


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return project


def _check_access(project: Project, current_user: User) -> None:
    """Usuario solo puede ver/comentar en sus propios proyectos. Admin+ ve todo."""
    if current_user.role == "usuario" and project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este proyecto.")


@router.get("", response_model=list[CommentRead])
def list_comments(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)
    return get_comments(db, project_id)


@router.post("", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def add_comment(
    project_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)
    return create_comment(db, project_id, current_user, payload)
