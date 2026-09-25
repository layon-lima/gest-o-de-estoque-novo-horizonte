from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.entities import router as entities_router
from app.api.relatorios import router as relatorios_router
from app.api.estoque import router as estoque_router
from app.api.reservas import router as reservas_router
from app.api.files import router as files_router
from app.api.users import router as users_router
from app.core.scheduler import (
    iniciar_agendador,
    parar_agendador,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    iniciar_agendador()

    yield

    parar_agendador()


app = FastAPI(
    title="API Estoque Novo Horizonte",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(users_router)
app.include_router(files_router)
app.include_router(entities_router)
app.include_router(relatorios_router)
app.include_router(estoque_router)
app.include_router(reservas_router)


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "api": "Estoque Novo Horizonte",
    }


# Proteção contra alterações diretas nas tabelas
# legadas de saldo e movimentação.
from app.core.stock_guard import (
    bloquear_mutacoes_estoque_legacy,
)

app.middleware("http")(
    bloquear_mutacoes_estoque_legacy
)