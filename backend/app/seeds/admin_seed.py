from sqlmodel import Session, select
from app.models.user import User
from app.core.security import hash_password
from app.config import settings


def seed_superadmin(db: Session) -> None:
    """
    Crea el superadmin por defecto al iniciar si no existe.
    Credenciales configurables desde .env
    """
    existing = db.exec(
        select(User).where(User.email == settings.superadmin_email)
    ).first()

    if not existing:
        superadmin = User(
            email=settings.superadmin_email,
            full_name="Super Administrador",
            hashed_password=hash_password(settings.superadmin_password),
            role="superadmin",
            area="TI",
            is_active=True,
        )
        db.add(superadmin)
        db.commit()
        print(f"[seed] Superadmin creado: {settings.superadmin_email}")
    else:
        print(f"[seed] Superadmin ya existe: {settings.superadmin_email}")
