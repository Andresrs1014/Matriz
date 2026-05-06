# backend/app/services/matrix_service.py
from sqlmodel import Session, select
from app.models.matrix import (
    MatrixQuestion, MatrixEvaluation, EvaluationResponse, QuestionCategory
)
from app.models.project_question import ProjectQuestion
from app.schemas.matrix import EvaluationSubmit
from sqlmodel import col  


def calculate_scores(responses: list[dict]) -> tuple[float, float]:
    """
    responses: lista de dicts con keys: axis, value, weight
    Retorna (impact_score, effort_score) en rango 0-100
    """
    impact_items = [r for r in responses if r["axis"] == "impact"]
    effort_items = [r for r in responses if r["axis"] == "effort"]

    def weighted_score(items: list[dict]) -> float:
        if not items:
            return 0.0
        total_weight = sum(i["weight"] for i in items)
        if total_weight == 0:
            return 0.0
        raw = sum(i["value"] * i["weight"] for i in items) / total_weight
        # value va de 1 a 5 → normalizar a 0-100
        return round((raw - 1) / 4 * 100, 2)

    return weighted_score(impact_items), weighted_score(effort_items)


def determine_quadrant(impact: float, effort: float) -> str:
    if impact >= 50 and effort < 50:
        return "esencial"
    elif impact >= 50 and effort >= 50:
        return "estrategico"
    elif impact < 50 and effort < 50:
        return "indiferente"
    else:
        return "lujo"


def create_evaluation(project_id: int, payload: EvaluationSubmit, db: Session) -> MatrixEvaluation:
    responses_data = []

    for r in payload.responses:
        if r.question_id is not None:
            # Pregunta del catálogo (MatrixQuestion)
            mq = db.get(MatrixQuestion, r.question_id)
            if mq and mq.is_active:
                responses_data.append({
                    "axis": mq.axis,
                    "value": r.value,
                    "weight": mq.weight,
                    "question_id": mq.id,
                    "project_question_id": None,
                })

        elif r.project_question_id is not None:
            # ← CORREGIDO: Pregunta custom (ProjectQuestion)
            pq = db.get(ProjectQuestion, r.project_question_id)
            if pq:
                responses_data.append({
                    "axis": pq.axis,  # ← Lee el eje real del modelo, no adivina
                    "value": r.value,
                    "weight": 1.0,    # peso uniforme para preguntas custom
                    "question_id": None,
                    "project_question_id": pq.id,
                })

    if not responses_data:
        raise ValueError("No hay respuestas válidas para evaluar")

    impact_score, effort_score = calculate_scores(responses_data)
    quadrant = determine_quadrant(impact_score, effort_score)

    evaluation = MatrixEvaluation(
        project_id=project_id,
        category_id=payload.category_id,
        impact_score=impact_score,
        effort_score=effort_score,
        quadrant=quadrant,
        notes=payload.notes,
    )
    db.add(evaluation)
    db.flush()  # para obtener evaluation.id antes del commit
    assert evaluation.id is not None, "evaluation.id no puede ser None"

    # ← CORREGIDO: Guardar TODAS las respuestas, incluidas las custom
    for r_data in responses_data:
        db.add(EvaluationResponse(
            evaluation_id=evaluation.id,
            question_id=r_data["question_id"],
            project_question_id=r_data["project_question_id"],
            value=r_data["value"] if isinstance(r_data["value"], int) else int(r_data["value"]),
        ))

    db.commit()
    db.refresh(evaluation)
    return evaluation

# ── Agregar al final de matrix_service.py ─────────────────────────────────────

def get_active_categories(db: Session) -> list[QuestionCategory]:
    """Retorna todos los paquetes de preguntas activos."""
    return list(db.exec(
        select(QuestionCategory).where(QuestionCategory.is_active == True)
    ).all())


def get_active_questions(db: Session, category_id: int | None = None) -> list[MatrixQuestion]:
    """Retorna preguntas activas, opcionalmente filtradas por paquete."""
    query = select(MatrixQuestion).where(MatrixQuestion.is_active == True)
    if category_id is not None:
        query = query.where(MatrixQuestion.category_id == category_id)
    return list(db.exec(query).all())


def get_evaluations_for_project(
    db: Session, project_id: int, owner_id: int | None = None
) -> list[MatrixEvaluation]:
    """Historial de evaluaciones de un proyecto."""
    return list(db.exec(
        select(MatrixEvaluation)
        .where(MatrixEvaluation.project_id == project_id)
        .order_by(col(MatrixEvaluation.created_at))  # ← col() corregido
    ).all())

def get_latest_evaluation_per_project(
    db: Session, owner_id: int | None = None
) -> list[dict]:
    """Última evaluación de cada proyecto para el scatter plot."""
    from app.models.project import Project

    project_ids = db.exec(
        select(MatrixEvaluation.project_id).distinct()
    ).all()

    results = []
    for pid in project_ids:
        # Filtrar por owner si aplica
        project = db.get(Project, pid)
        if not project:
            continue
        if owner_id is not None and project.owner_id != owner_id:
            continue

        # Última evaluación de este proyecto
        latest = db.exec(
            select(MatrixEvaluation)
            .where(MatrixEvaluation.project_id == pid)
            .order_by(col(MatrixEvaluation.created_at).desc())
        ).first()

        if latest:
            results.append({
                "project_id": pid,
                "project_title": project.title,       # ← título del proyecto
                "impact_score": latest.impact_score,
                "effort_score": latest.effort_score,
                "quadrant": latest.quadrant,
                "evaluation_id": latest.id,
                "evaluated_at": latest.created_at,
            })

    return results

