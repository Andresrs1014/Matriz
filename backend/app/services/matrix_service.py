# backend/app/services/matrix_service.py
from fastapi import HTTPException, status
from sqlmodel import Session, select, col
from typing import cast

from app.models.matrix import MatrixQuestion, MatrixEvaluation, EvaluationResponse, QuestionCategory
from app.models.project import Project
from app.schemas.matrix import EvaluationSubmit, MatrixPlotPoint


def assign_quadrant(impact_score: float, effort_score: float) -> str:
    alto_impacto  = impact_score  >= 50
    alto_esfuerzo = effort_score  >= 50
    if alto_impacto  and not alto_esfuerzo: return "esencial"
    if alto_impacto  and alto_esfuerzo:     return "estrategico"
    if not alto_impacto and not alto_esfuerzo: return "indiferente"
    return "lujo"


def calculate_scores(
    db: Session,
    responses: list[dict],
) -> tuple[float, float]:
    """
    Calcula scores de impacto y esfuerzo.
    
    Si la pregunta no existe en MatrixQuestion (fue custom), usa distribución
    por posición: primeras mitad = impacto, segunda mitad = esfuerzo.
    """
    question_ids = [r["question_id"] for r in responses]

    # Intentar obtener MatrixQuestions para eje y peso
    matrix_questions: list[MatrixQuestion] = list(
        db.exec(
            select(MatrixQuestion)
            .where(col(MatrixQuestion.id).in_(question_ids))
        )
    )
    mq_map = {q.id: q for q in matrix_questions}

    # Construir lista ordenada de (question_id, axis, weight)
    ordered = []
    for resp in responses:
        qid = resp["question_id"]
        if qid in mq_map:
            q = mq_map[qid]
            ordered.append({"id": qid, "axis": q.axis, "weight": q.weight})
        else:
            ordered.append({"id": qid, "axis": None, "weight": 1.0})

    # Para los que no tienen eje, asignar por posición
    no_axis = [i for i, q in enumerate(ordered) if q["axis"] is None]
    half = len(no_axis) // 2
    for i, idx in enumerate(no_axis):
        ordered[idx]["axis"] = "impact" if i < half else "effort"

    impact_qs = [q for q in ordered if q["axis"] == "impact"]
    effort_qs = [q for q in ordered if q["axis"] == "effort"]

    if not impact_qs or not effort_qs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El set de preguntas debe tener al menos 1 de impacto y 1 de esfuerzo.",
        )

    resp_map = {r["question_id"]: r["value"] for r in responses}

    impact_weighted_sum = impact_max = 0.0
    for q in impact_qs:
        value = resp_map.get(q["id"], 1)
        impact_weighted_sum += value * q["weight"]
        impact_max += 5 * q["weight"]

    effort_weighted_sum = effort_max = 0.0
    for q in effort_qs:
        value = resp_map.get(q["id"], 1)
        effort_weighted_sum += value * q["weight"]
        effort_max += 5 * q["weight"]

    impact_score = round((impact_weighted_sum / impact_max) * 100, 2) if impact_max > 0 else 0.0
    effort_score = round((effort_weighted_sum / effort_max) * 100, 2) if effort_max > 0 else 0.0
    return impact_score, effort_score


def get_active_categories(db: Session) -> list[QuestionCategory]:
    return list(db.exec(
        select(QuestionCategory)
        .where(QuestionCategory.is_active == True)
        .order_by(col(QuestionCategory.name))
    ))


def get_active_questions(db: Session, category_id: int | None = None) -> list[MatrixQuestion]:
    query = select(MatrixQuestion).where(MatrixQuestion.is_active == True)
    if category_id is not None:
        query = query.where(MatrixQuestion.category_id == category_id)
    return list(db.exec(query.order_by(MatrixQuestion.axis, col(MatrixQuestion.order))))


def create_evaluation(
    db: Session,
    project_id: int,
    owner_id: int,
    payload: EvaluationSubmit,
) -> MatrixEvaluation:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")

    responses_raw = [{"question_id": r.question_id, "value": r.value} for r in payload.responses]
    impact_score, effort_score = calculate_scores(db, responses_raw)
    quadrant = assign_quadrant(impact_score, effort_score)

    evaluation = MatrixEvaluation(
        project_id=project_id,
        category_id=payload.category_id,
        impact_score=impact_score,
        effort_score=effort_score,
        quadrant=quadrant,
        notes=payload.notes,
    )
    db.add(evaluation)
    db.flush()

    # Solo persistir respuestas cuyo question_id existe en MatrixQuestion
    # para no violar la FK matrixquestion.id
    response_question_ids = [r.question_id for r in payload.responses]
    valid_question_ids: set[int] = {
        cast(int, q.id)
        for q in db.exec(
            select(MatrixQuestion).where(col(MatrixQuestion.id).in_(response_question_ids))
        )
    }
    for r in payload.responses:
        if r.question_id in valid_question_ids:
            db.add(EvaluationResponse(
                evaluation_id=cast(int, evaluation.id),
                question_id=r.question_id,
                value=r.value,
            ))
    db.commit()
    db.refresh(evaluation)
    return evaluation


def get_evaluations_for_project(
    db: Session, project_id: int, owner_id: int
) -> list[MatrixEvaluation]:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return list(db.exec(
        select(MatrixEvaluation)
        .where(MatrixEvaluation.project_id == project_id)
        .order_by(col(MatrixEvaluation.created_at).desc())
    ))


def get_latest_evaluation_per_project(
    db: Session, owner_id: int | None
) -> list[MatrixPlotPoint]:
    if owner_id is None:
        projects = list(db.exec(select(Project)))
    else:
        projects = list(db.exec(select(Project).where(Project.owner_id == owner_id)))

    plot_points: list[MatrixPlotPoint] = []
    for project in projects:
        latest = db.exec(
            select(MatrixEvaluation)
            .where(MatrixEvaluation.project_id == project.id)
            .order_by(col(MatrixEvaluation.created_at).desc())
        ).first()
        if latest:
            plot_points.append(MatrixPlotPoint(
                project_id=cast(int, project.id),
                project_title=project.title,
                impact_score=latest.impact_score,
                effort_score=latest.effort_score,
                quadrant=latest.quadrant,
                evaluation_id=cast(int, latest.id),
                evaluated_at=latest.created_at,
            ))
    return plot_points
