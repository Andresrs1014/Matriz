from fastapi import HTTPException, status
from sqlmodel import Session, select, col
from app.core.security import hash_password, verify_password
from app.models.user import User

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.exec(select(User).where(User.email == email)).first()

def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)

def get_all_users(db: Session) -> list[User]:
    return list(db.exec(select(User).order_by(col(User.created_at))))

def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str | None = None,
    area: str | None = None,
    role: str = "usuario",          # Fix Bug 1 — era "user"
) -> User:
    existing = get_user_by_email(db, email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado."
        )
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        area=area,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo."
        )
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas."
        )
    return user

def update_user_role(db: Session, user: User, new_role: str) -> User:
    VALID_ROLES = ("superadmin", "admin", "coordinador", "usuario")  # Fix Bug 2
    if new_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Rol inválido. Valores permitidos: {', '.join(VALID_ROLES)}"
        )
    user.role = new_role
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_user(db: Session, user: User, data: dict) -> User:
    for k, v in data.items():
        if v is not None:
            setattr(user, k, v)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def deactivate_user(db: Session, user: User) -> User:
    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
