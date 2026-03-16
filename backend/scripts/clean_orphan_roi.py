import os
from sqlmodel import Session, select
from app.models.roi import ROIEvaluation
from app.models.project import Project
from app.database import engine

def clean_orphan_roi():
    with Session(engine) as session:
        all_projects = set(p.id for p in session.exec(select(Project)).all())
        all_rois = session.exec(select(ROIEvaluation)).all()
        count = 0
        for roi in all_rois:
            if roi.project_id not in all_projects:
                session.delete(roi)
                count += 1
        session.commit()
        print(f"Eliminados {count} ROIEvaluation huérfanos.")

if __name__ == "__main__":
    clean_orphan_roi()