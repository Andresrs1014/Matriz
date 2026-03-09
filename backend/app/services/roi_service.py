from typing import cast
from sqlmodel import Session, select, col
from app.models.project import Project
from app.models.roi import ROIEvaluation
from app.schemas.roi import ROIParte1Input, ROIParte2Input, ROIPlotPoint

ROI_PCT_UMBRAL = 50.0
HORAS_UMBRAL   = 4.0


def _calcular_valor_hora(salario_base: float) -> dict:
    return {
        "valor_quincena":    round(salario_base / 2, 2),
        "valor_dia":         round(salario_base / 30, 2),
        "valor_hora_hombre": round(salario_base / (30 * 8), 2),
    }


def assign_roi_quadrant(roi_pct: float, horas_ahorradas: float) -> str:
    alto_roi    = roi_pct >= ROI_PCT_UMBRAL
    ahorra_bien = horas_ahorradas >= HORAS_UMBRAL
    if alto_roi and ahorra_bien:      return "alto_impacto"
    if not alto_roi and ahorra_bien:  return "proceso_pesado"
    if alto_roi and not ahorra_bien:  return "eficiencia_menor"
    return "bajo_impacto"


def calculate_roi(parte1: ROIParte1Input, parte2: ROIParte2Input) -> dict:
    valores    = _calcular_valor_hora(parte1.salario_base)
    valor_hora = valores["valor_hora_hombre"]
    horas_ahorradas = round(parte2.horas_proceso_actual - parte2.horas_proyectadas, 2)
    roi_valor       = round(horas_ahorradas * valor_hora, 2)
    roi_valor_total = round(roi_valor * parte1.num_personas, 2)
    roi_pct         = round(
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


def create_roi_parte1(db: Session, project_id: int, parte1: ROIParte1Input) -> ROIEvaluation:
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


# ── NUEVO: historial completo ─────────────────────────────────────────────────
def get_roi_history(db: Session, project_id: int) -> list[ROIEvaluation]:
    return list(db.exec(
        select(ROIEvaluation)
        .where(ROIEvaluation.project_id == project_id)
        .order_by(col(ROIEvaluation.created_at).desc())
    ).all())


def get_roi_plot_points(db: Session, owner_id: int | None = None) -> list[ROIPlotPoint]:
    query = select(Project)
    if owner_id is not None:
        query = query.where(Project.owner_id == owner_id)
    projects = list(db.exec(query))
    points: list[ROIPlotPoint] = []
    for project in projects:
        latest = get_latest_roi(db, cast(int, project.id))
        if latest and latest.horas_proceso_actual > 0:
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
