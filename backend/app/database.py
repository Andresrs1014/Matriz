# backend/app/database.py
from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import text
from app.config import settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if settings.database_url.startswith("sqlite"):
            db_path = settings.database_url.replace("sqlite:///", "")
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
            connect_args = {"check_same_thread": False}
        _engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)
    return _engine


def create_db_and_tables() -> None:
    engine = get_engine()
    SQLModel.metadata.create_all(engine)


def run_migrations() -> None:
    """
    Migraciones manuales para SQLite.
    SQLite no soporta RENAME COLUMN en versiones antiguas ni DROP COLUMN,
    así que para el renombre de horas_proyectadas → horas_proceso_nuevo
    usamos una estrategia segura: agregar la columna nueva y copiar los datos.
    Cada bloque tiene try/except — si la columna ya existe, no falla.
    """
    engine = get_engine()

    migrations = [
        # ── Columnas previas ────────────────────────────────────────────────
        ("user.deactivated_at",
         "ALTER TABLE user ADD COLUMN deactivated_at DATETIME"),
        ("project.okr_objectives",
         "ALTER TABLE project ADD COLUMN okr_objectives TEXT"),
        ("project.key_results",
         "ALTER TABLE project ADD COLUMN key_results TEXT"),
        ("project.key_actions",
         "ALTER TABLE project ADD COLUMN key_actions TEXT"),
        ("project.resources",
         "ALTER TABLE project ADD COLUMN resources TEXT"),
        ("project.five_whys",
         "ALTER TABLE project ADD COLUMN five_whys TEXT"),
        ("project.measurement_methods",
         "ALTER TABLE project ADD COLUMN measurement_methods TEXT"),
        ("project.submitted_by_name",
         "ALTER TABLE project ADD COLUMN submitted_by_name TEXT"),
        ("project.collaborators_json",
         "ALTER TABLE project ADD COLUMN collaborators_json TEXT"),

        # ── ROI: columnas renombradas / nuevas ──────────────────────────────
        # Agregar columna con el nombre nuevo (horas_proceso_nuevo)
        ("roievaluation.horas_proceso_nuevo",
         "ALTER TABLE roievaluation ADD COLUMN horas_proceso_nuevo FLOAT NOT NULL DEFAULT 0.0"),

        # Copiar datos de horas_proyectadas → horas_proceso_nuevo si existía antes
        ("roievaluation.horas_proceso_nuevo.copy",
         "UPDATE roievaluation SET horas_proceso_nuevo = horas_proyectadas WHERE horas_proyectadas IS NOT NULL"),

        # Columnas nuevas del modelo ROI actualizado
        ("roievaluation.ahorro_horas_hombre",
         "ALTER TABLE roievaluation ADD COLUMN ahorro_horas_hombre FLOAT NOT NULL DEFAULT 0.0"),

        ("roievaluation.valor_ahorro",
         "ALTER TABLE roievaluation ADD COLUMN valor_ahorro FLOAT NOT NULL DEFAULT 0.0"),

        ("roievaluation.horas_proceso_actual",
         "ALTER TABLE roievaluation ADD COLUMN horas_proceso_actual FLOAT NOT NULL DEFAULT 0.0"),

        ("roievaluation.horas_ahorradas",
         "ALTER TABLE roievaluation ADD COLUMN horas_ahorradas FLOAT NOT NULL DEFAULT 0.0"),

        # Eliminar columna vieja horas_proyectadas (renombrada a horas_proceso_nuevo)
        # SQLite 3.35+ soporta DROP COLUMN
        ("roievaluation.drop_horas_proyectadas",
         "ALTER TABLE roievaluation DROP COLUMN horas_proyectadas"),
    ]

    with engine.connect() as conn:
        for description, sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"[migration] Aplicada: {description}")
            except Exception:
                # Columna ya existe o tabla no tiene la columna origen → no es error
                pass


def get_session():
    engine = get_engine()
    with Session(engine) as session:
        yield session
