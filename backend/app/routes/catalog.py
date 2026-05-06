from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user, require_admin
from app.models.user import User
from app.schemas.catalog import WorkAreaCreate, WorkAreaRead, WorkSiteCreate, WorkSiteRead
from app.services import work_catalog_service as cat

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get("/areas", response_model=list[WorkAreaRead])
def get_areas(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = cat.list_work_areas(db)
    return [WorkAreaRead(id=r.id, name=r.name, sort_order=r.sort_order) for r in rows]


@router.get("/sites", response_model=list[WorkSiteRead])
def get_sites(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = cat.list_work_sites(db)
    return [WorkSiteRead(id=r.id, name=r.name, sort_order=r.sort_order) for r in rows]


@router.post("/areas", response_model=WorkAreaRead)
def post_area(
    payload: WorkAreaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = cat.create_work_area(db, payload.name, payload.sort_order)
    return WorkAreaRead(id=row.id, name=row.name, sort_order=row.sort_order)


@router.post("/sites", response_model=WorkSiteRead)
def post_site(
    payload: WorkSiteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = cat.create_work_site(db, payload.name, payload.sort_order)
    return WorkSiteRead(id=row.id, name=row.name, sort_order=row.sort_order)


@router.delete("/areas/{area_id}")
def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    cat.delete_work_area(db, area_id)
    return {"ok": True}


@router.delete("/sites/{site_id}")
def delete_site(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    cat.delete_work_site(db, site_id)
    return {"ok": True}
