from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

import app.models  # noqa: F401

from app.config import settings
from app.core.ws_manager import ws_manager
from app.database import create_db_and_tables, get_engine
from app.routes.auth      import router as auth_router
from app.routes.projects  import router as projects_router
from app.routes.matrix    import router as matrix_router
from app.routes.webhook   import router as webhook_router
from app.routes.dashboard import router as dashboard_router
from app.routes.settings  import router as settings_router
from app.seeds.questions_seed import seed_matrix_questions
from app.seeds.admin_seed     import seed_superadmin


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    engine = get_engine()
    with Session(engine) as db:
        seed_matrix_questions(db)
        seed_superadmin(db)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(matrix_router)
app.include_router(webhook_router)
app.include_router(dashboard_router)
app.include_router(settings_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@app.get("/health", tags=["Health"])
def health():
    return {"ok": True, "env": settings.env, "version": "0.4.0"}
