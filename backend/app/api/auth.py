from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
)
from app.db.database import get_db
from app.models import User


router = APIRouter(prefix="/api/auth", tags=["Autenticação"])
bearer_scheme = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateMeRequest(BaseModel):
    display_name: str


def _lista_json(valor):
    if valor is None:
        return None

    if isinstance(valor, list):
        return valor

    try:
        resultado = json.loads(valor)
        return resultado if isinstance(resultado, list) else []
    except Exception:
        return []


def user_publico(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "pode_confirmar_abastecimento": user.pode_confirmar_abastecimento,
        "pode_digitar_peso": user.pode_digitar_peso,
        "paginas_permitidas": _lista_json(user.paginas_permitidas),
        "setores_permitidos": _lista_json(user.setores_permitidos),
        "ativo": user.ativo,
        "created_date": user.created_date,
        "updated_date": user.updated_date,
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado.",
        )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada.",
        )

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida.",
        )

    user = db.get(User, user_id)

    if user is None or not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário inexistente ou desativado.",
        )

    return user


@router.post("/login")
def login(
    dados: LoginRequest,
    db: Session = Depends(get_db),
):
    username = dados.username.strip()

    stmt = select(User).where(
        func.lower(User.username) == username.lower()
    )

    user = db.scalar(stmt)

    if (
        user is None
        or not user.ativo
        or not verify_password(dados.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )

    token = create_access_token(
        user_id=user.id,
        username=user.username,
        role=user.role,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_publico(user),
    }


@router.get("/me")
def me(
    current_user: User = Depends(get_current_user),
):
    return user_publico(current_user)


@router.patch("/me")
def atualizar_me(
    dados: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    nome = dados.display_name.strip()

    if not nome:
        raise HTTPException(
            status_code=400,
            detail="Informe um nome.",
        )

    current_user.display_name = nome

    db.commit()
    db.refresh(current_user)

    return user_publico(current_user)
