from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.dependencies import get_db, require_admin
from app.models.matrix import QuestionCategory, MatrixQuestion
from app.models.user import User
from app.schemas.settings import (
    CategoryCreate, CategoryUpdate, CategoryRead,
    QuestionCreate, QuestionUpdate, QuestionRead,
)

router = APIRouter(prefix="/settings", tags=["Settings"])


# ══════════════════════════════════════════════════════
# CATEGORÍAS
# ══════════════════════════════════════════════════════

@router.get("/categories", response_model=list[CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    categories = db.exec(select(QuestionCategory).order_by(QuestionCategory.id)).all()
    result = []
    for cat in categories:
        count = len(db.exec(
            select(MatrixQuestion).where(MatrixQuestion.category_id == cat.id)
        ).all())
        result.append(CategoryRead(
            id=cat.id, name=cat.name, description=cat.description,
            is_active=cat.is_active, is_default=cat.is_default,
            question_count=count,
        ))
    return result


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    # Si el nuevo es default, quitar default a los demás
    if payload.is_default:
        existing = db.exec(select(QuestionCategory).where(QuestionCategory.is_default == True)).all()
        for cat in existing:
            cat.is_default = False
            db.add(cat)

    cat = QuestionCategory(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryRead(
        id=cat.id, name=cat.name, description=cat.description,
        is_active=cat.is_active, is_default=cat.is_default,
        question_count=0,
    )


@router.put("/categories/{cat_id}", response_model=CategoryRead)
def update_category(
    cat_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    cat = db.get(QuestionCategory, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")

    if payload.is_default:
        existing = db.exec(select(QuestionCategory).where(QuestionCategory.is_default == True)).all()
        for c in existing:
            c.is_default = False
            db.add(c)

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(cat, k, v)
    db.add(cat)
    db.commit()
    db.refresh(cat)

    count = len(db.exec(select(MatrixQuestion).where(MatrixQuestion.category_id == cat.id)).all())
    return CategoryRead(
        id=cat.id, name=cat.name, description=cat.description,
        is_active=cat.is_active, is_default=cat.is_default,
        question_count=count,
    )


@router.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    cat = db.get(QuestionCategory, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    if cat.is_default:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar la categoría por defecto. Asigna otra primero."
        )
    db.delete(cat)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════
# PREGUNTAS
# ══════════════════════════════════════════════════════

@router.get("/questions", response_model=list[QuestionRead])
def list_all_questions(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    questions = db.exec(
        select(MatrixQuestion).order_by(MatrixQuestion.category_id, MatrixQuestion.order)
    ).all()
    return [QuestionRead(**q.model_dump()) for q in questions]


@router.get("/questions/category/{cat_id}", response_model=list[QuestionRead])
def list_questions_by_category(
    cat_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    questions = db.exec(
        select(MatrixQuestion)
        .where(MatrixQuestion.category_id == cat_id)
        .order_by(MatrixQuestion.order)
    ).all()
    return [QuestionRead(**q.model_dump()) for q in questions]


@router.post("/questions", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if payload.axis not in ("impact", "effort"):
        raise HTTPException(status_code=422, detail="axis debe ser 'impact' o 'effort'.")
    q = MatrixQuestion(**payload.model_dump())
    db.add(q)
    db.commit()
    db.refresh(q)
    return QuestionRead(**q.model_dump())


@router.put("/questions/{q_id}", response_model=QuestionRead)
def update_question(
    q_id: int,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.get(MatrixQuestion, q_id)
    if not q:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada.")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(q, k, v)
    db.add(q)
    db.commit()
    db.refresh(q)
    return QuestionRead(**q.model_dump())


@router.delete("/questions/{q_id}")
def delete_question(
    q_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.get(MatrixQuestion, q_id)
    if not q:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada.")
    db.delete(q)
    db.commit()
    return {"ok": True}
