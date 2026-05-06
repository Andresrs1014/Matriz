# backend/app/services/dev_team_service.py
from sqlmodel import Session, select

from app.models.dev_team import DevTeamMember
from app.models.user import User


def get_team_members(db: Session) -> list[tuple[DevTeamMember, User]]:
    """Retorna todos los miembros del equipo con su info de usuario."""
    members = db.exec(select(DevTeamMember)).all()
    result: list[tuple[DevTeamMember, User]] = []
    for m in members:
        user = db.get(User, m.user_id)
        if user:
            result.append((m, user))
    return result


def get_team_emails(db: Session) -> list[str]:
    pairs = get_team_members(db)
    return [user.email for _, user in pairs]


def add_team_member(db: Session, user_id: int) -> DevTeamMember:
    existing = db.exec(
        select(DevTeamMember).where(DevTeamMember.user_id == user_id)
    ).first()
    if existing:
        return existing
    member = DevTeamMember(user_id=user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def remove_team_member(db: Session, user_id: int) -> bool:
    member = db.exec(
        select(DevTeamMember).where(DevTeamMember.user_id == user_id)
    ).first()
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True
