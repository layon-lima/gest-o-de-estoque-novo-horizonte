from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.users import exigir_admin
from app.db.database import get_db
from app.models import User
from app.services.consistencia_estoque import (
    verificar_consistencia_estoque,
)


router = APIRouter(
    prefix="/api/admin",
    tags=["Administração"],
)


@router.post("/verificar-consistencia-estoque")
def verificar_consistencia(
    _: User = Depends(exigir_admin),
    db: Session = Depends(get_db),
):
    return verificar_consistencia_estoque(
        db
    )
