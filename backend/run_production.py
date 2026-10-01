from __future__ import annotations

from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config

from app.core.config import settings


BASE_DIR = Path(__file__).resolve().parent


def aplicar_migrations() -> None:
    """Aplica migrations pendentes antes de abrir o backend de produção."""
    config = Config(str(BASE_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BASE_DIR / "alembic"))
    command.upgrade(config, "head")


if __name__ == "__main__":
    aplicar_migrations()

    uvicorn.run(
        "app.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=False,
        workers=1,
        log_level="info",
    )
