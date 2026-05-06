from __future__ import annotations

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.models.work_catalog import WorkArea, WorkSite


def list_work_areas(db: Session) -> list[WorkArea]:
    return list(db.exec(select(WorkArea).order_by(col(WorkArea.sort_order), col(WorkArea.name))))


def list_work_sites(db: Session) -> list[WorkSite]:
    return list(db.exec(select(WorkSite).order_by(col(WorkSite.sort_order), col(WorkSite.name))))


def create_work_area(db: Session, name: str, sort_order: int = 0) -> WorkArea:
    n = (name or "").strip()
    if not n:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El nombre no puede estar vacío.")
    row = WorkArea(name=n, sort_order=sort_order)
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un área con ese nombre.",
        ) from None
    db.refresh(row)
    return row


def create_work_site(db: Session, name: str, sort_order: int = 0) -> WorkSite:
    n = (name or "").strip()
    if not n:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El nombre no puede estar vacío.")
    row = WorkSite(name=n, sort_order=sort_order)
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una sede con ese nombre.",
        ) from None
    db.refresh(row)
    return row


def delete_work_area(db: Session, area_id: int) -> None:
    from app.models.user import User

    row = db.get(WorkArea, area_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Área no encontrada.")
    if db.exec(select(User.id).where(User.work_area_id == area_id).limit(1)).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: hay usuarios asignados a esta área.",
        )
    db.delete(row)
    db.commit()


def delete_work_site(db: Session, site_id: int) -> None:
    from app.models.user import User

    row = db.get(WorkSite, site_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sede no encontrada.")
    if db.exec(select(User.id).where(User.work_site_id == site_id).limit(1)).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: hay usuarios asignados a esta sede.",
        )
    db.delete(row)
    db.commit()


def resolve_work_area_id_by_name(db: Session, name: str | None) -> int | None:
    if not name or not str(name).strip():
        return None
    key = str(name).strip().lower()
    for row in list_work_areas(db):
        if row.name.strip().lower() == key:
            return row.id
    return None
