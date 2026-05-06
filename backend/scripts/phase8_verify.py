#!/usr/bin/env python3
"""
Verificación Fase 8 (plan-matriz-mejoras.md).

  cd backend && python scripts/phase8_verify.py
"""
from __future__ import annotations

import os
import sqlite3
import sys

print("Phase 8 - Backend checks")
print("=" * 56)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.chdir(ROOT)

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def ok(msg: str) -> None:
    print(f"[OK] {msg}")


def warn(msg: str) -> None:
    print(f"[SKIP/WARN] {msg}")


def fail(msg: str, exc: BaseException | None = None) -> None:
    print(f"[FAIL] {msg}")
    if exc is not None:
        print(f"       {exc!r}")
    sys.exit(1)


try:
    from sqlmodel import Session, select
except ImportError as e:
    fail("Import sqlmodel", e)

try:
    from app.models import DevTeamMember, SMTPConfig

    ok("Imports DevTeamMember, SMTPConfig")
except ImportError as e:
    fail("Import modelo SMTP/DevTeam", e)

try:
    from app.database import create_db_and_tables, get_engine, run_migrations

except ImportError as e:
    fail("Import app.database", e)

try:
    create_db_and_tables()
    run_migrations()
    ok("create_db_and_tables() + run_migrations() sin excepcion")
except Exception as e:
    fail("create_db_and_tables / run_migrations", e)

try:
    eng = get_engine()
except Exception as e:
    fail("get_engine()", e)

# ── Inspect SQLite ─────────────────────────────────────────────────────────────
try:
    raw_url = eng.url  # type: ignore[attr-defined]
    if getattr(raw_url, "drivername", "").startswith("sqlite"):
        dbpath = getattr(raw_url, "database", None)
        if not dbpath or dbpath == ":memory:":
            warn("DATABASE :memory - inspeccion de tablas omitida")
        else:
            resolved = dbpath if os.path.isabs(dbpath) else os.path.abspath(os.path.join(ROOT, dbpath.replace("\\", "/")))
            conn = sqlite3.connect(resolved)
            cur = conn.cursor()
            tables = {r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            for t in ("devteammember", "smtpconfig", "project"):
                if t not in tables:
                    fail(f"Tabla faltante: {t}")
            ok("Tablas devteammember, smtpconfig, project presentes")
            cols = {r[1] for r in cur.execute("PRAGMA table_info(project)")}
            for c in ("assigned_to_dev", "assigned_to_dev_at", "assigned_to_dev_by"):
                if c not in cols:
                    fail(f"Columna project.{c} ausente")
            ok("Columnas assigned_to_dev* en project")
            conn.close()
    else:
        warn("Motor no SQLite - revisar migraciones manualmente")
except Exception as e:
    fail("Inspeccion SQLite", e)

# ── TestClient ─────────────────────────────────────────────────────────────────
try:
    from fastapi.testclient import TestClient

    from app.core.security import hash_password
    from app.main import app
    from app.models.project import Project
    from app.models.user import User

    with Session(eng) as db:
        sa_user = db.exec(select(User).where(User.email == "phase8_sa@test.local")).first()
        if not sa_user:
            sa_user = User(
                email="phase8_sa@test.local",
                hashed_password=hash_password("pwd-phase8-test"),
                full_name="Phase8 SA",
                role="superadmin",
                is_active=True,
            )
            db.add(sa_user)
            db.commit()
            db.refresh(sa_user)
        usr_user = db.exec(select(User).where(User.email == "phase8_u@test.local")).first()
        if not usr_user:
            usr_user = User(
                email="phase8_u@test.local",
                hashed_password=hash_password("pwd-phase8-test"),
                full_name="Phase8 User",
                role="usuario",
                is_active=True,
            )
            db.add(usr_user)
            db.commit()
            db.refresh(usr_user)
        proj = db.exec(select(Project).where(Project.owner_id == usr_user.id)).first()
        if not proj:
            proj = Project(title="Phase8 proyecto", owner_id=usr_user.id)
            db.add(proj)
            db.commit()
            db.refresh(proj)
        proj_id = proj.id

    client = TestClient(app)

    def _login(email: str, password: str) -> str:
        res = client.post("/auth/token", data={"username": email, "password": password})
        if res.status_code != 200:
            fail(f"login {email}", Exception(res.text))
        return res.json()["access_token"]

    token_sa = _login("phase8_sa@test.local", "pwd-phase8-test")
    token_u = _login("phase8_u@test.local", "pwd-phase8-test")

    h_sa = {"Authorization": f"Bearer {token_sa}"}

    r_smtp = client.get("/settings/smtp", headers=h_sa)
    if r_smtp.status_code not in (404, 200):
        fail(f"GET /settings/smtp inesperado {r_smtp.status_code}", Exception(r_smtp.text))
    ok(f"GET /settings/smtp -> {r_smtp.status_code}")

    r_test = client.post("/settings/smtp/test", headers=h_sa)
    if r_test.status_code not in (404, 502):
        fail(f"POST /settings/smtp/test inesperado {r_test.status_code}", Exception(r_test.text))
    ok(f"POST /settings/smtp/test (sin SMTP valido) -> {r_test.status_code}")

    r_bad = client.post(f"/projects/{proj_id}/assign-to-dev", headers={"Authorization": f"Bearer {token_u}"})
    if r_bad.status_code != 403:
        fail(f"assign-to-dev usuario != 403: {r_bad.status_code}")
    ok("POST assign-to-dev usuario -> 403")

    client.delete(f"/projects/{proj_id}/assign-to-dev", headers=h_sa)
    r_ok = client.post(f"/projects/{proj_id}/assign-to-dev", headers=h_sa)
    if r_ok.status_code != 200:
        fail(f"assign-to-dev SA != 200: {r_ok.status_code}", Exception(r_ok.text))
    ok("POST assign-to-dev superadmin -> 200")

    r_comm = client.post(
        f"/projects/{proj_id}/comments",
        headers={"Authorization": f"Bearer {token_u}"},
        json={"message": "Actualización Phase8 (sin garantía SMTP)", "tipo": "actualizacion"},
    )
    if r_comm.status_code != 201:
        fail(f"POST comentario actualizacion != 201: {r_comm.status_code}", Exception(r_comm.text))
    ok("POST comentario tipo actualizacion -> 201 (no bloquea sin SMTP)")

except ImportError as e:
    warn(f"TestClient u app.main no importables ({e})")
except AssertionError:
    raise
except Exception as e:
    fail("Suite TestClient", e)

print("=" * 56)
print("Siguientes pasos:")
print('  Frontend: ejecutar desde raiz frontend "npm run build"')
print("  Comentario tipo actualizacion + SMTP sin bloquear: usar TestClient opcional.")
print("Phase 8 - script terminado.")
