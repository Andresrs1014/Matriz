from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from jose.exceptions import JWTError
from app.core.security import decode_token
from app.database import get_engine
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

def get_db():
    with Session(get_engine()) as session:
        yield session

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("sub")
    user  = db.exec(select(User).where(User.email == email)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo.")
    return user


# ── Guards por rol ─────────────────────────────────────────────────────────────
ROLES_HIERARCHY = {"usuario": 0, "coordinador": 1, "admin": 2, "superadmin": 3}

def _require_role(min_role: str):
    def guard(current_user: User = Depends(get_current_user)) -> User:
        user_level = ROLES_HIERARCHY.get(current_user.role, -1)
        min_level  = ROLES_HIERARCHY.get(min_role, 99)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere rol '{min_role}' o superior."
            )
        return current_user
    return guard

# Guards listos para usar en cualquier ruta
require_coordinador = _require_role("coordinador")
require_admin       = _require_role("admin")
require_superadmin  = _require_role("superadmin")
