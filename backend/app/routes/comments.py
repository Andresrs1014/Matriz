from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.core.dependencies import get_db, get_current_user
from app.core.ws_manager import ws_manager
from app.models.user import User
from app.models.project import Project
from app.schemas.comment import CommentCreate, CommentRead
from app.services.comment_service import create_comment, get_comments, delete_comment

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
    # Para usuarios normales filtramos en BD: solo sus comentarios + feedback/cambio_estado
    author_filter = current_user.id if current_user.role == "usuario" else None
    return get_comments(db, project_id, author_id=author_filter)


@router.post("", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def add_comment(
    project_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)
    comment = create_comment(db, project_id, current_user, payload)
    await ws_manager.broadcast("comment.created", {
        "id":          comment.id,
        "project_id":  comment.project_id,
        "author_id":   comment.author_id,
        "author_role": comment.author_role,
        "author_name": comment.author_name,
        "message":     comment.message,
        "tipo":        comment.tipo,
        "created_at":  comment.created_at.isoformat(),
    })
    return comment


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_comment(
    project_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _check_access(project, current_user)
    delete_comment(db, project_id, comment_id, current_user)
