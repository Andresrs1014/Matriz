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
            # Crea la carpeta data/ si no existe antes de que SQLite intente escribir
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
    Migraciones manuales: agrega columnas nuevas a tablas existentes sin perder datos.
    Agregar aquí cada ALTER TABLE cuando se añada un campo al modelo.
    SQLite ignora el error si la columna ya existe gracias al try/except.
    """
    engine = get_engine()
    migrations = [
        # Formato: (descripción, SQL)
        ("user.deactivated_at", "ALTER TABLE user ADD COLUMN deactivated_at DATETIME"),
    ]
    with engine.connect() as conn:
        for description, sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"[migration] Aplicada: {description}")
            except Exception:
                # La columna ya existe — no es un error
                pass


def get_session():
    engine = get_engine()
    with Session(engine) as session:
        yield session
