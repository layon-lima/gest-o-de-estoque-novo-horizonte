from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import (
    get_current_user,
    user_publico,
)
from app.core.access_control import (
    VALID_PAGE_KEYS,
)
from app.core.security import hash_password
from app.services.auditoria_erp import registrar_auditoria
from app.db.database import get_db
from app.models import Setor, User


router = APIRouter(
    prefix="/api/users",
    tags=["Usuários"],
)


class CriarUsuarioRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100,
    )
    password: str = Field(
        min_length=4,
        max_length=200,
    )
    display_name: str = Field(
        min_length=1,
        max_length=255,
    )
    role: Literal[
        "admin",
        "user",
    ] = "user"


class AtualizarUsuarioRequest(BaseModel):
    display_name: str | None = None
    role: (
        Literal["admin", "user"]
        | None
    ) = None
    pode_confirmar_abastecimento: (
        bool | None
    ) = None
    pode_digitar_peso: (
        bool | None
    ) = None
    pode_baixar_mobile: bool | None = None
    pode_mudar_gaveta_mobile: bool | None = None
    pode_mudar_deposito_mobile: bool | None = None
    pode_entrada_manual_saldo_mobile: bool | None = None
    paginas_permitidas: (
        list[str] | None
    ) = None
    setores_permitidos: (
        list[str] | None
    ) = None
    ativo: bool | None = None
    password: str | None = None


def exigir_admin(
    current_user: User = Depends(
        get_current_user
    ),
) -> User:
    if (
        current_user.role
        != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Acesso permitido somente "
                "para administradores."
            ),
        )

    return current_user


def quantidade_admins_ativos(
    db: Session,
) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.role == "admin",
                User.ativo.is_(True),
            )
        )
        or 0
    )


def _validar_paginas(
    paginas: list[str],
):
    invalidas = sorted(
        {
            pagina
            for pagina in paginas
            if pagina
            not in VALID_PAGE_KEYS
        }
    )

    if invalidas:
        raise HTTPException(
            status_code=400,
            detail=(
                "Permissões de página "
                "inválidas: "
                + ", ".join(
                    invalidas
                )
            ),
        )


def _validar_setores(
    db: Session,
    setores: list[str],
):
    ids = {
        str(setor_id)
        for setor_id in setores
        if setor_id
    }

    if not ids:
        return

    existentes = set(
        db.scalars(
            select(Setor.id)
            .where(
                Setor.id.in_(ids)
            )
        ).all()
    )

    ausentes = sorted(
        ids - existentes
    )

    if ausentes:
        raise HTTPException(
            status_code=400,
            detail=(
                "Setor(es) de permissão "
                "não encontrado(s): "
                + ", ".join(
                    ausentes
                )
            ),
        )


@router.get("")
def listar_usuarios(
    _: User = Depends(
        exigir_admin
    ),
    db: Session = Depends(get_db),
):
    usuarios = db.scalars(
        select(User)
        .order_by(
            User.created_date.desc()
        )
    ).all()

    return [
        user_publico(user)
        for user in usuarios
    ]


@router.get("/{user_id}")
def obter_usuario(
    user_id: str,
    _: User = Depends(
        exigir_admin
    ),
    db: Session = Depends(get_db),
):
    usuario = db.get(
        User,
        user_id,
    )

    if not usuario:
        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado.",
        )

    return user_publico(usuario)


@router.post("")
def criar_usuario(
    dados: CriarUsuarioRequest,
    current_user: User = Depends(
        exigir_admin
    ),
    db: Session = Depends(get_db),
):
    username = (
        dados.username.strip()
    )

    display_name = (
        dados.display_name.strip()
    )

    existente = db.scalar(
        select(User).where(
            func.lower(
                User.username
            )
            == username.lower()
        )
    )

    if existente:
        raise HTTPException(
            status_code=409,
            detail=(
                "Esse nome de usuário "
                "já existe."
            ),
        )

    user = User(
        username=username,
        password_hash=hash_password(
            dados.password
        ),
        display_name=display_name,
        role=dados.role,
        pode_confirmar_abastecimento=False,
        pode_digitar_peso=False,
        pode_baixar_mobile=False,
        pode_mudar_gaveta_mobile=False,
        pode_mudar_deposito_mobile=False,
        pode_entrada_manual_saldo_mobile=False,
        paginas_permitidas=json.dumps(
            [],
            ensure_ascii=False,
        ),
        setores_permitidos=json.dumps(
            [],
            ensure_ascii=False,
        ),
        ativo=True,
    )

    db.add(user)
    db.flush()

    registrar_auditoria(
        db,
        usuario=current_user,
        acao="criar",
        entidade="User",
        registro_id=user.id,
        depois=user_publico(user),
    )

    db.commit()
    db.refresh(user)

    return user_publico(user)


@router.patch("/{user_id}")
def atualizar_usuario(
    user_id: str,
    dados: AtualizarUsuarioRequest,
    current_user: User = Depends(
        exigir_admin
    ),
    db: Session = Depends(get_db),
):
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Usuário não encontrado."
            ),
        )

    if (
        user.role == "admin"
        and user.ativo
        and quantidade_admins_ativos(
            db
        ) <= 1
    ):
        removendo_admin = (
            dados.role == "user"
        )

        desativando = (
            dados.ativo is False
        )

        if (
            removendo_admin
            or desativando
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "O sistema precisa "
                    "manter pelo menos um "
                    "administrador ativo."
                ),
            )

    if (
        user.id
        == current_user.id
        and dados.role == "user"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Você não pode remover "
                "sua própria permissão "
                "de administrador."
            ),
        )

    antes = user_publico(
        user
    )

    if (
        dados.display_name
        is not None
    ):
        nome = (
            dados.display_name.strip()
        )

        if not nome:
            raise HTTPException(
                status_code=400,
                detail=(
                    "O nome não pode "
                    "ficar vazio."
                ),
            )

        user.display_name = nome

    if dados.role is not None:
        user.role = dados.role

    if (
        dados.pode_confirmar_abastecimento
        is not None
    ):
        user.pode_confirmar_abastecimento = (
            dados.pode_confirmar_abastecimento
        )

    if (
        dados.pode_digitar_peso
        is not None
    ):
        user.pode_digitar_peso = (
            dados.pode_digitar_peso
        )

    if dados.pode_baixar_mobile is not None:
        user.pode_baixar_mobile = dados.pode_baixar_mobile

    if dados.pode_mudar_gaveta_mobile is not None:
        user.pode_mudar_gaveta_mobile = dados.pode_mudar_gaveta_mobile

    if dados.pode_mudar_deposito_mobile is not None:
        user.pode_mudar_deposito_mobile = dados.pode_mudar_deposito_mobile

    if dados.pode_entrada_manual_saldo_mobile is not None:
        user.pode_entrada_manual_saldo_mobile = (
            dados.pode_entrada_manual_saldo_mobile
        )

    if (
        dados.paginas_permitidas
        is not None
    ):
        _validar_paginas(
            dados.paginas_permitidas
        )

        user.paginas_permitidas = (
            json.dumps(
                dados.paginas_permitidas,
                ensure_ascii=False,
            )
        )

    if (
        dados.setores_permitidos
        is not None
    ):
        _validar_setores(
            db,
            dados.setores_permitidos,
        )

        user.setores_permitidos = (
            json.dumps(
                dados.setores_permitidos,
                ensure_ascii=False,
            )
        )

    if dados.ativo is not None:
        user.ativo = dados.ativo

    if (
        dados.password
        is not None
    ):
        if (
            len(dados.password)
            < 4
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "A senha deve possuir "
                    "pelo menos 4 caracteres."
                ),
            )

        user.password_hash = (
            hash_password(
                dados.password
            )
        )

    db.flush()

    registrar_auditoria(
        db,
        usuario=current_user,
        acao="atualizar",
        entidade="User",
        registro_id=user.id,
        antes=antes,
        depois=user_publico(user),
    )

    db.commit()
    db.refresh(user)

    return user_publico(user)


@router.delete("/{user_id}")
def excluir_usuario(
    user_id: str,
    current_user: User = Depends(
        exigir_admin
    ),
    db: Session = Depends(get_db),
):
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Usuário não encontrado."
            ),
        )

    if (
        user.id
        == current_user.id
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Você não pode excluir "
                "seu próprio usuário."
            ),
        )

    if (
        user.role == "admin"
        and user.ativo
        and quantidade_admins_ativos(
            db
        ) <= 1
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "O sistema precisa manter "
                "pelo menos um "
                "administrador ativo."
            ),
        )

    registrar_auditoria(
        db,
        usuario=current_user,
        acao="excluir",
        entidade="User",
        registro_id=user.id,
        antes=user_publico(user),
    )

    db.delete(user)
    db.commit()

    return {
        "success": True
    }
