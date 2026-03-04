from sqlmodel import Session, select

from app.models.matrix import MatrixQuestion


IMPACT_QUESTIONS = [
    ("impact_lead_time",          "¿Reduce el lead time del proceso?",                                                          1),
    ("impact_errores_despacho",   "¿Elimina errores críticos de despacho?",                                                     2),
    ("impact_escalabilidad",      "¿Mejora la escalabilidad si sube el volumen de pedidos?",                                    3),
    ("impact_visibilidad_cliente","¿Aumenta la visibilidad del cliente sobre el estado de su envío en tiempo real?",            4),
    ("impact_ahorro_costos",      "¿Genera ahorro de costos directos (combustible, horas extra, insumos de embalaje)?",         5),
]

EFFORT_QUESTIONS = [
    ("effort_integracion_legacy",   "¿Requiere integración con sistemas legacy sin APIs abiertas?",                            1),
    ("effort_curva_aprendizaje",    "¿La curva de aprendizaje para el personal operativo es alta?",                            2),
    ("effort_calidad_datos",        "¿La calidad actual de los datos exige una limpieza significativa previa?",                3),
    ("effort_infraestructura",      "¿Requiere inversión en hardware físico (sensores, equipos) vs solo software?",            4),
    ("effort_resistencia_cambio",   "¿Existe alta resistencia al cambio por ser disruptivo para los operarios actuales?",      5),
]


def seed_matrix_questions(db: Session) -> None:
    # Al seleccionar una sola columna SQLModel retorna escalares, no objetos
    existing: set[str] = set(db.exec(select(MatrixQuestion.key)).all())

    to_create: list[MatrixQuestion] = []

    for key, text, order in IMPACT_QUESTIONS:
        if key not in existing:
            to_create.append(MatrixQuestion(key=key, axis="impact", text=text, weight=1.0, order=order, is_active=True))

    for key, text, order in EFFORT_QUESTIONS:
        if key not in existing:
            to_create.append(MatrixQuestion(key=key, axis="effort", text=text, weight=1.0, order=order, is_active=True))

    if to_create:
        for q in to_create:
            db.add(q)
        db.commit()
        print(f"[seed] {len(to_create)} preguntas insertadas.")
    else:
        print("[seed] Preguntas ya existentes. No se insertó nada.")
