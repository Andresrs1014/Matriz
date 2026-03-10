from sqlmodel import Session, select, col
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


def get_comments(db: Session, project_id: int) -> list[ProjectComment]:
    return list(db.exec(
        select(ProjectComment)
        .where(ProjectComment.project_id == project_id)
        .order_by(col(ProjectComment.created_at).asc())
    ).all())


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
