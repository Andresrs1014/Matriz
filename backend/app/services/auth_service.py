from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status
from sqlmodel import Session, select, col
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.work_catalog import WorkArea, WorkSite
from app.schemas.auth import SuperadminUpdateUserRequest


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.exec(select(User).where(User.email == email)).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_all_users(db: Session) -> list[User]:
    """Retorna solo usuarios activos."""
    return list(db.exec(
        select(User)
        .where(User.is_active == True)
        .order_by(col(User.created_at))
    ))


def get_archived_users(db: Session) -> list[User]:
    """Retorna usuarios inactivos desactivados hace menos de 6 meses."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=180)
    return list(db.exec(
        select(User)
        .where(User.is_active == False)
        .where(col(User.deactivated_at) >= cutoff)
        .order_by(col(User.deactivated_at).desc())
    ))


def _require_work_area_fk(db: Session, work_area_id: int | None) -> None:
    if work_area_id is None:
        return
    if db.get(WorkArea, work_area_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Área inválida.")


def _require_work_site_fk(db: Session, work_site_id: int | None) -> None:
    if work_site_id is None:
        return
    if db.get(WorkSite, work_site_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sede inválida.")


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str | None = None,
    work_area_id: int | None = None,
    work_site_id: int | None = None,
    role: str = "usuario",
) -> User:
    existing = get_user_by_email(db, email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado.",
        )
    _require_work_area_fk(db, work_area_id)
    _require_work_site_fk(db, work_site_id)
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        work_area_id=work_area_id,
        work_site_id=work_site_id,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo.")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas.")
    return user


def update_user_role(db: Session, user: User, new_role: str) -> User:
    VALID_ROLES = ("superadmin", "admin", "coordinador", "usuario")
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


def user_area_and_site_labels(db: Session, u: User) -> tuple[str | None, str | None]:
    an = sn = None
    if u.work_area_id:
        wa = db.get(WorkArea, u.work_area_id)
        an = wa.name if wa else None
    if u.work_site_id:
        ws = db.get(WorkSite, u.work_site_id)
        sn = ws.name if ws else None
    return an, sn


def token_area_claim(db: Session, u: User) -> str | None:
    an, _ = user_area_and_site_labels(db, u)
    return an


def update_user_superadmin(
    db: Session,
    target: User,
    actor: User,
    payload: SuperadminUpdateUserRequest,
) -> User:
    data = payload.model_dump(exclude_unset=True, exclude={"password", "confirm_superadmin_password"})

    new_pwd = (payload.password or "").strip()
    if new_pwd:
        if len(new_pwd) < 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La contraseña debe tener al menos 5 caracteres.",
            )
        conf = (payload.confirm_superadmin_password or "").strip()
        if not conf:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Introduce tu contraseña de superadmin para confirmar el cambio.",
            )
        if not verify_password(conf, actor.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña de superadmin no es correcta.",
            )
        target.hashed_password = hash_password(new_pwd)

    if "email" in data:
        ne = data["email"]
        if ne != target.email:
            if get_user_by_email(db, ne):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ese email ya está en uso.",
                )
            target.email = ne

    if "full_name" in data:
        target.full_name = data["full_name"]

    if "work_area_id" in data:
        wid = data["work_area_id"]
        _require_work_area_fk(db, wid)
        target.work_area_id = wid

    if "work_site_id" in data:
        sid = data["work_site_id"]
        _require_work_site_fk(db, sid)
        target.work_site_id = sid

    if "is_active" in data:
        target.is_active = data["is_active"]

    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def deactivate_user(db: Session, user: User) -> User:
    """Desactiva el usuario — va a la lista de archivados."""
    user.is_active = False
    user.deactivated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def reactivate_user(db: Session, user: User) -> User:
    """Reactiva un usuario archivado."""
    user.is_active = True
    user.deactivated_at = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def permanent_delete_user(db: Session, user: User) -> None:
    """Elimina el usuario permanentemente de la DB en cascada."""
    db.delete(user)
    db.commit()
