from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models import (
    Abastecimento,
    AnoSafra,
    Cultura,
    Deposito,
    EstoqueSaldo,
    Gaveta,
    Inventario,
    InventarioItem,
    Lavoura,
    Lote,
    Maquina,
    OrdemServicoAplicacao,
    Pagamento,
    PedidoPesagem,
    Pessoa,
    Produto,
    Setor,
    TicketPesagem,
    User,
    Veiculo,
)


router = APIRouter(
    prefix="/api/entities",
    tags=["Entidades"],
    dependencies=[Depends(get_current_user)],
)


MODELS = {
    "Abastecimento": Abastecimento,
    "AnoSafra": AnoSafra,
    "Cultura": Cultura,
    "Deposito": Deposito,
    "Gaveta": Gaveta,
    "Inventario": Inventario,
    "InventarioItem": InventarioItem,
    "Lavoura": Lavoura,
    "Lote": Lote,
    "Maquina": Maquina,
    "OrdemServicoAplicacao": OrdemServicoAplicacao,
    "Pagamento": Pagamento,
    "PedidoPesagem": PedidoPesagem,
    "Pessoa": Pessoa,
    "Produto": Produto,
    "Setor": Setor,
    "TicketPesagem": TicketPesagem,
    "User": User,
    "Veiculo": Veiculo,
}



LEGACY_ESTOQUE_BLOQUEADAS = {
    "Movimentacao",
    "SaldoEstoque",
}

MUTACAO_BLOQUEADA = {
    "Lote",
}


def validar_mutacao(entidade: str):
    if entidade in LEGACY_ESTOQUE_BLOQUEADAS:
        raise HTTPException(
            status_code=410,
            detail=(
                f"A entidade '{entidade}' pertence ao estoque legado. "
                "Use a API /api/estoque."
            ),
        )

    if entidade in MUTACAO_BLOQUEADA:
        raise HTTPException(
            status_code=409,
            detail=(
                "Lotes s??o controlados pelo motor ERP e s??o somente leitura "
                "pela API gen??rica."
            ),
        )


def obter_modelo(nome: str):
    if nome in LEGACY_ESTOQUE_BLOQUEADAS:
        raise HTTPException(
            status_code=410,
            detail=(
                f"A entidade '{nome}' pertence ao estoque legado. "
                "Use a API /api/estoque."
            ),
        )

    if nome == "User":
        raise HTTPException(
            status_code=403,
            detail="UsuÃ¡rios sÃ£o gerenciados pela API administrativa.",
        )

    model = MODELS.get(nome)

    if model is None:
        raise HTTPException(
            status_code=404,
            detail=f"Entidade '{nome}' nÃ£o encontrada.",
        )

    return model

def serializar(obj) -> dict[str, Any]:
    return {
        coluna.name: getattr(obj, coluna.name)
        for coluna in obj.__table__.columns
        if coluna.name != "password_hash"
    }


def preparar_dados(model, dados: dict[str, Any]) -> dict[str, Any]:
    resultado = {}

    for coluna in model.__table__.columns:
        nome = coluna.name

        if (
            model.__name__ in {"Produto", "Lote"}
            and nome == "quantidade"
        ):
            continue

        if nome not in dados:
            continue

        valor = dados[nome]

        if valor == "":
            try:
                tipo = coluna.type.python_type
                if tipo in (date, datetime):
                    valor = None
            except Exception:
                pass

        if valor is not None:
            try:
                tipo = coluna.type.python_type

                if tipo is datetime and isinstance(valor, str):
                    valor = datetime.fromisoformat(
                        valor.replace("Z", "+00:00")
                    )

                elif tipo is date and isinstance(valor, str):
                    valor = date.fromisoformat(valor[:10])

            except (ValueError, TypeError, NotImplementedError):
                pass

        resultado[nome] = valor

    return resultado


def aplicar_ordenacao(stmt, model, sort: str | None):
    if not sort:
        return stmt

    descendente = sort.startswith("-")
    campo = sort[1:] if descendente else sort

    coluna = getattr(model, campo, None)

    if coluna is None:
        return stmt

    if descendente:
        return stmt.order_by(desc(coluna))

    return stmt.order_by(asc(coluna))


@router.get("/{entidade}")
def listar(
    entidade: str,
    sort: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    model = obter_modelo(entidade)

    stmt = select(model)
    stmt = aplicar_ordenacao(stmt, model, sort)

    if limit is not None:
        stmt = stmt.limit(limit)

    registros = db.scalars(stmt).all()

    return [serializar(registro) for registro in registros]


@router.post("/{entidade}/filter")
def filtrar(
    entidade: str,
    filtros: dict[str, Any],
    sort: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    model = obter_modelo(entidade)

    stmt = select(model)

    for campo, valor in filtros.items():
        coluna = getattr(model, campo, None)

        if coluna is None:
            continue

        stmt = stmt.where(coluna == valor)

    stmt = aplicar_ordenacao(stmt, model, sort)

    if limit is not None:
        stmt = stmt.limit(limit)

    registros = db.scalars(stmt).all()

    return [serializar(registro) for registro in registros]


@router.get("/{entidade}/{registro_id}")
def obter(
    entidade: str,
    registro_id: str,
    db: Session = Depends(get_db),
):
    model = obter_modelo(entidade)

    registro = db.get(model, registro_id)

    if registro is None:
        raise HTTPException(
            status_code=404,
            detail="Registro not found.",
        )

    return serializar(registro)


@router.post("/{entidade}")
def criar(
    entidade: str,
    dados: dict[str, Any],
    db: Session = Depends(get_db),
):
    validar_mutacao(entidade)
    model = obter_modelo(entidade)

    dados_limpos = preparar_dados(model, dados)

    registro = model(**dados_limpos)

    db.add(registro)
    db.commit()
    db.refresh(registro)

    return serializar(registro)


@router.patch("/{entidade}/{registro_id}")
def atualizar(
    entidade: str,
    registro_id: str,
    dados: dict[str, Any],
    db: Session = Depends(get_db),
):
    validar_mutacao(entidade)
    model = obter_modelo(entidade)

    registro = db.get(model, registro_id)

    if registro is None:
        raise HTTPException(
            status_code=404,
            detail="Registro not found.",
        )

    dados_limpos = preparar_dados(model, dados)

    for campo, valor in dados_limpos.items():
        if campo == "id":
            continue

        setattr(registro, campo, valor)

    db.commit()
    db.refresh(registro)

    return serializar(registro)


@router.delete("/{entidade}/{registro_id}")
def excluir(
    entidade: str,
    registro_id: str,
    db: Session = Depends(get_db),
):
    validar_mutacao(entidade)
    model = obter_modelo(entidade)

    campos_saldo = {
        "Produto": EstoqueSaldo.produto_id,
        "Deposito": EstoqueSaldo.deposito_id,
        "Gaveta": EstoqueSaldo.gaveta_id,
    }

    campo_saldo = campos_saldo.get(entidade)

    if campo_saldo is not None:
        saldo_vinculado = db.scalar(
            select(EstoqueSaldo.id)
            .where(campo_saldo == registro_id)
            .limit(1)
        )

        if saldo_vinculado:
            raise HTTPException(
                status_code=409,
                detail=(
                    "N??o ?? poss??vel excluir este cadastro porque existem "
                    "posi????es de estoque ERP vinculadas."
                ),
            )

    registro = db.get(model, registro_id)

    if registro is None:
        raise HTTPException(
            status_code=404,
            detail="Registro not found.",
        )

    db.delete(registro)
    db.commit()

    return {"success": True}


@router.post("/{entidade}/bulk-update")
def atualizar_em_lote(
    entidade: str,
    registros: list[dict[str, Any]],
    db: Session = Depends(get_db),
):
    validar_mutacao(entidade)
    model = obter_modelo(entidade)

    atualizados = []

    for dados in registros:
        registro_id = dados.get("id")

        if not registro_id:
            continue

        registro = db.get(model, registro_id)

        if registro is None:
            continue

        dados_limpos = preparar_dados(model, dados)

        for campo, valor in dados_limpos.items():
            if campo == "id":
                continue

            setattr(registro, campo, valor)

        atualizados.append(registro)

    db.commit()

    for registro in atualizados:
        db.refresh(registro)

    return [serializar(registro) for registro in atualizados]
