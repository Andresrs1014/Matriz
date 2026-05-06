from sqlmodel import Session, select, col
from fastapi import HTTPException, status
from app.models.comment import ProjectComment
from app.models.user import User
from app.schemas.comment import CommentCreate

def create_comment(
    db: Session,
    project_id: int,
    author: User,
    payload: CommentCreate,
) -> ProjectComment:
    assert author.id is not None, "El autor debe estar guardado en BD"
    comment = ProjectComment(
        project_id  = project_id,
        author_id   = author.id,
        author_role = author.role,
        author_name = author.full_name or author.email,
        message     = payload.message,
        tipo        = payload.tipo,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_comments(
    db: Session,
    project_id: int,
    author_id: int | None = None,
) -> list[ProjectComment]:
    query = (
        select(ProjectComment)
        .where(ProjectComment.project_id == project_id)
    )
    if author_id is not None:
        query = query.where(
            (ProjectComment.author_id == author_id) |
            (ProjectComment.tipo == "feedback") |
            (ProjectComment.tipo == "cambio_estado")
        )
    query = query.order_by(col(ProjectComment.created_at).asc())
    return list(db.exec(query).all())


def delete_comment(
    db: Session,
    project_id: int,
    comment_id: int,
    current_user: User,
) -> None:
    comment = db.get(ProjectComment, comment_id)
    if not comment or comment.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comentario no encontrado.")
    # Solo el autor o admins pueden borrar
    if comment.author_id != current_user.id and current_user.role not in ("admin", "superadmin", "coordinador"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes eliminar este comentario.")
    db.delete(comment)
    db.commit()


def create_status_comment(
    db: Session,
    project_id: int,
    author: User,
    message: str,
) -> ProjectComment:
    """Crea automáticamente un comentario de tipo cambio_estado."""
    return create_comment(db, project_id, author, CommentCreate(
        message=message,
        tipo="cambio_estado"
    ))
