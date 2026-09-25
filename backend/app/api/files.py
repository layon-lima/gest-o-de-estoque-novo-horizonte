from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.api.auth import get_current_user
from app.models import User


router = APIRouter(
    prefix="/api/files",
    tags=["Arquivos"],
)


UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    extensao = Path(file.filename or "").suffix.lower()

    nome_arquivo = f"{uuid4()}{extensao}"

    destino = UPLOAD_DIR / nome_arquivo

    conteudo = await file.read()

    destino.write_bytes(conteudo)

    file_url = str(
        request.url_for(
            "uploads",
            path=nome_arquivo,
        )
    )

    return {
        "file_url": file_url,
        "filename": nome_arquivo,
    }
