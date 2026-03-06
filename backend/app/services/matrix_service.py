from fastapi import HTTPException, status
from sqlmodel import Session, select, col

from app.models.matrix import MatrixQuestion, MatrixEvaluation, EvaluationResponse, QuestionCategory
from app.models.project import Project
from app.schemas.matrix import EvaluationSubmit, EvaluationRead, MatrixPlotPoint, QuadrantSummary


# ── Cuadrante ─────────────────────────────────────────────────────────────────

QUADRANT_MAP = {
    # (alto_impacto, bajo_esfuerzo) → ESENCIAL
    # (alto_impacto, alto_esfuerzo) → ESTRATÉGICO
    # (bajo_impacto, bajo_esfuerzo) → INDIFERENTE
    # (bajo_impacto, alto_esfuerzo) → LUJO
}

def assign_quadrant(impact_score: float, effort_score: float) -> str:
    """
    El punto de quiebre de cuadrante es 50 en ambos ejes.
    Eje Y = impact_score  (mayor = más arriba en la matriz)
    Eje X = effort_score  (mayor = más a la derecha)
    """
    alto_impacto = impact_score >= 50
    alto_esfuerzo = effort_score >= 50

    if alto_impacto and not alto_esfuerzo:
        return "esencial"
    if alto_impacto and alto_esfuerzo:
        return "estrategico"
    if not alto_impacto and not alto_esfuerzo:
        return "indiferente"
    return "lujo"


QUADRANT_LABELS = {
    "esencial":    "Esencial",
    "estrategico": "Estratégico",
    "indiferente": "Indiferente",
    "lujo":        "Lujo",
}


# ── Scoring ───────────────────────────────────────────────────────────────────

def calculate_scores(
    db: Session,
    responses: list[dict],   # [{"question_id": int, "value": int}, ...]
) -> tuple[float, float]:
    """
    Calcula impact_score y effort_score ponderados en escala 0-100.
    Funciona con cualquier cantidad de preguntas (flexible por categoría).
    """
    question_ids = [r["question_id"] for r in responses]
    questions: list[MatrixQuestion] = list(
        db.exec(
            select(MatrixQuestion)
            .where(MatrixQuestion.id.in_(question_ids))
            .where(MatrixQuestion.is_active == True)
        )
    )

    impact_qs = [q for q in questions if q.axis == "impact"]
    effort_qs = [q for q in questions if q.axis == "effort"]

    if not impact_qs or not effort_qs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La categoría debe tener al menos una pregunta de impacto y una de esfuerzo."
        )

    resp_map = {r["question_id"]: r["value"] for r in responses}

    impact_weighted_sum = 0.0
    impact_max = 0.0
    effort_weighted_sum = 0.0
    effort_max = 0.0

    for q in questions:
        value = resp_map.get(q.id, 1)
        weighted_value = value * q.weight
        if q.axis == "impact":
            impact_weighted_sum += weighted_value
            impact_max += 5 * q.weight
        elif q.axis == "effort":
            effort_weighted_sum += weighted_value
            effort_max += 5 * q.weight

    impact_score = round((impact_weighted_sum / impact_max) * 100, 2) if impact_max > 0 else 0.0
    effort_score = round((effort_weighted_sum / effort_max) * 100, 2) if effort_max > 0 else 0.0

    return impact_score, effort_score


# ── CRUD Categorías ────────────────────────────────────────────────────────────

def get_active_categories(db: Session) -> list[QuestionCategory]:
    return list(
        db.exec(
            select(QuestionCategory)
            .where(QuestionCategory.is_active == True)
            .order_by(col(QuestionCategory.name))
        )
    )


# ── CRUD Preguntas ─────────────────────────────────────────────────────────────

def get_active_questions(db: Session, category_id: int | None = None) -> list[MatrixQuestion]:
    query = (
        select(MatrixQuestion)
        .where(MatrixQuestion.is_active == True)
    )
    if category_id is not None:
        query = query.where(MatrixQuestion.category_id == category_id)
    return list(
        db.exec(query.order_by(MatrixQuestion.axis, col(MatrixQuestion.order)))
    )


# ── CRUD Evaluaciones ─────────────────────────────────────────────────────────

def create_evaluation(
    db: Session,
    project_id: int,
    owner_id: int,
    payload: EvaluationSubmit,
) -> MatrixEvaluation:
    # Verificar que el proyecto existe y pertenece al usuario
    project = db.get(Project, project_id)
    if not project or project.owner_id != owner_id:
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
    db.flush()  # Obtiene el ID sin commit final aún

    for r in payload.responses:
        db.add(EvaluationResponse(
            evaluation_id=evaluation.id,
            question_id=r.question_id,
            value=r.value,
        ))

    db.commit()
    db.refresh(evaluation)
    return evaluation


def get_evaluations_for_project(db: Session, project_id: int, owner_id: int) -> list[MatrixEvaluation]:
    project = db.get(Project, project_id)
    if not project or project.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return list(
        db.exec(
            select(MatrixEvaluation)
            .where(MatrixEvaluation.project_id == project_id)
            .order_by(col(MatrixEvaluation.created_at).desc())
        )
    )


def get_latest_evaluation_per_project(db: Session, owner_id: int | None) -> list[MatrixPlotPoint]:
    """
    Para cada proyecto del usuario, trae SOLO la evaluación más reciente.
    Esto alimenta el gráfico de la matriz cuadrante en el frontend.
    owner_id=None significa sin filtro (admin/superadmin ven todos los proyectos).
    """
    if owner_id is None:
        projects = list(db.exec(select(Project)))
    else:
        projects = list(
            db.exec(select(Project).where(Project.owner_id == owner_id))
        )

    plot_points: list[MatrixPlotPoint] = []

    for project in projects:
        latest = db.exec(
            select(MatrixEvaluation)
            .where(MatrixEvaluation.project_id == project.id)
            .order_by(col(MatrixEvaluation.created_at).desc())
        ).first()

        if latest:
            plot_points.append(MatrixPlotPoint(
                project_id=project.id,
                project_title=project.title,
                impact_score=latest.impact_score,
                effort_score=latest.effort_score,
                quadrant=latest.quadrant,
                evaluation_id=latest.id,
                evaluated_at=latest.created_at,
            ))

    return plot_points
