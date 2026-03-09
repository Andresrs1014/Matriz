from typing import cast
from sqlmodel import Session, select, col
from app.models.project import Project
from app.models.roi import ROIEvaluation
from app.schemas.roi import ROIParte1Input, ROIParte2Input, ROIPlotPoint

# ── Umbrales de cuadrantes ────────────────────────────────────────────────────
ROI_PCT_UMBRAL = 50.0   # >= 50% horas ahorradas vs actuales → alto impacto
HORAS_UMBRAL   = 4.0    # >= 4 horas ahorradas → proceso relevante


def _calcular_valor_hora(salario_base: float) -> dict:
    """Mes de 30 días calendario, jornada de 8 horas."""
    return {
        "valor_quincena":   round(salario_base / 2, 2),
        "valor_dia":        round(salario_base / 30, 2),
        "valor_hora_hombre": round(salario_base / (30 * 8), 2),
    }


def assign_roi_quadrant(roi_pct: float, horas_ahorradas: float) -> str:
    """
    Ejes:
      X → horas_proceso_actual  (peso del proceso hoy)
      Y → horas_ahorradas       (mejora real)

    alto_impacto     → roi_pct >= 50% Y horas >= 4  → Ejecutar ya      🟢
    eficiencia_menor → roi_pct >= 50% Y horas < 4   → Planificar       🔵
    proceso_pesado   → roi_pct < 50%  Y horas >= 4  → Evaluar          🟡
    bajo_impacto     → roi_pct < 50%  Y horas < 4   → Revisar          🔴
    """
    alto_roi    = roi_pct >= ROI_PCT_UMBRAL
    ahorra_bien = horas_ahorradas >= HORAS_UMBRAL

    if alto_roi and ahorra_bien:
        return "alto_impacto"
    if alto_roi and not ahorra_bien:
        return "eficiencia_menor"
    if not alto_roi and ahorra_bien:
        return "proceso_pesado"
    return "bajo_impacto"


def calculate_roi(parte1: ROIParte1Input, parte2: ROIParte2Input) -> dict:
    valores = _calcular_valor_hora(parte1.salario_base)
    valor_hora = valores["valor_hora_hombre"]

    horas_ahorradas  = round(parte2.horas_proceso_actual - parte2.horas_proyectadas, 2)
    roi_valor        = round(horas_ahorradas * valor_hora, 2)             # 1 persona
    roi_valor_total  = round(roi_valor * parte1.num_personas, 2)          # todas las personas
    roi_pct          = round(
        (horas_ahorradas / parte2.horas_proceso_actual) * 100, 2
    ) if parte2.horas_proceso_actual > 0 else 0.0

    return {
        **valores,
        "horas_ahorradas":  horas_ahorradas,
        "roi_valor":        roi_valor,
        "roi_valor_total":  roi_valor_total,
        "roi_pct":          roi_pct,
        "cuadrante_roi":    assign_roi_quadrant(roi_pct, horas_ahorradas),
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────
def create_roi_parte1(db: Session, project_id: int, parte1: ROIParte1Input) -> ROIEvaluation:
    """Crea la evaluación ROI con datos del jefe. Parte 2 pendiente."""
    valores = _calcular_valor_hora(parte1.salario_base)
    evaluation = ROIEvaluation(
        project_id=project_id,
        cargo=parte1.cargo,
        sede=parte1.sede,
        num_personas=parte1.num_personas,
        salario_base=parte1.salario_base,
        **valores,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation


def update_roi_parte2(
    db: Session,
    evaluation: ROIEvaluation,
    parte1: ROIParte1Input,
    parte2: ROIParte2Input,
) -> ROIEvaluation:
    """Actualiza con proyección del analista y recalcula todo."""
    calculated = calculate_roi(parte1, parte2)

    evaluation.horas_proceso_actual = parte2.horas_proceso_actual
    evaluation.horas_proyectadas    = parte2.horas_proyectadas
    evaluation.horas_ahorradas      = calculated["horas_ahorradas"]
    evaluation.roi_valor            = calculated["roi_valor"]
    evaluation.roi_valor_total      = calculated["roi_valor_total"]
    evaluation.roi_pct              = calculated["roi_pct"]
    evaluation.cuadrante_roi        = calculated["cuadrante_roi"]

    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation


def get_latest_roi(db: Session, project_id: int) -> ROIEvaluation | None:
    return db.exec(
        select(ROIEvaluation)
        .where(ROIEvaluation.project_id == project_id)
        .order_by(col(ROIEvaluation.created_at).desc())
    ).first()


def get_roi_plot_points(db: Session, owner_id: int | None = None) -> list[ROIPlotPoint]:
    """Un punto por proyecto — evaluación ROI más reciente."""
    query = select(Project)
    if owner_id is not None:
        query = query.where(Project.owner_id == owner_id)
    projects = list(db.exec(query))

    points: list[ROIPlotPoint] = []
    for project in projects:
        latest = get_latest_roi(db, cast(int, project.id))
        if latest and latest.horas_proceso_actual > 0:  # solo evaluaciones completas
            points.append(ROIPlotPoint(
                project_id=cast(int, project.id),
                project_title=project.title,
                horas_proceso_actual=latest.horas_proceso_actual,
                horas_ahorradas=latest.horas_ahorradas,
                roi_pct=latest.roi_pct,
                roi_valor_total=latest.roi_valor_total,
                num_personas=latest.num_personas,
                cuadrante_roi=latest.cuadrante_roi,
                roi_id=cast(int, latest.id),
                evaluated_at=latest.created_at,
            ))
    return points
