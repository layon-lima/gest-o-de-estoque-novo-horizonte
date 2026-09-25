from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models import (
    EstoqueDocumento,
    EstoqueDocumentoItem,
    EstoqueSaldo,
    Produto,
    User,
)
from app.services.motor_estoque import (
    EstoqueErro,
    MOVIMENTOS_VALIDOS,
    estornar_documento,
    movimentar_estoque,
)


router = APIRouter(
    prefix="/api/estoque",
    tags=["Estoque"],
)


class MovimentoItemRequest(BaseModel):
    produto_id: str
    quantidade: Decimal = Field(gt=0)
    unidade: str | None = None
    fator_conversao: Decimal | None = Field(
        default=None,
        gt=0,
    )

    deposito_origem_id: str | None = None
    gaveta_origem_id: str | None = None
    lote_origem_id: str | None = None

    deposito_destino_id: str | None = None
    gaveta_destino_id: str | None = None
    lote_destino_id: str | None = None

    custo_unitario: Decimal | None = None
    data_validade: str | None = None
    observacao: str | None = None


class MovimentoRequest(BaseModel):
    tipo_movimento: str
    origem_modulo: str = "manual"
    documento_origem_id: str | None = None
    referencia_externa: str | None = None
    observacao: str | None = None
    itens: list[MovimentoItemRequest]


class EstornoRequest(BaseModel):
    motivo: str = Field(
        min_length=3,
        max_length=500,
    )


def _numero(valor):
    if valor is None:
        return 0

    return float(valor)


def _serializar_documento(
    db: Session,
    documento: EstoqueDocumento,
) -> dict[str, Any]:
    itens = db.scalars(
        select(EstoqueDocumentoItem)
        .where(
            EstoqueDocumentoItem.documento_id
            == documento.id
        )
        .order_by(
            EstoqueDocumentoItem.item_numero
        )
    ).all()

    return {
        "id": documento.id,
        "numero": documento.numero,
        "tipo_movimento": documento.tipo_movimento,
        "status": documento.status,
        "origem_modulo": documento.origem_modulo,
        "documento_origem_id": documento.documento_origem_id,
        "referencia_externa": documento.referencia_externa,
        "data_documento": documento.data_documento,
        "contabilizado_em": documento.contabilizado_em,
        "estornado_em": documento.estornado_em,
        "estorno_de_id": documento.estorno_de_id,
        "estornado_por_documento_id": (
            documento.estornado_por_documento_id
        ),
        "motivo_estorno": documento.motivo_estorno,
        "usuario_id": documento.usuario_id,
        "observacao": documento.observacao,
        "itens": [
            {
                "id": item.id,
                "item_numero": item.item_numero,
                "produto_id": item.produto_id,
                "quantidade": _numero(
                    item.quantidade
                ),
                "unidade": item.unidade,
                "quantidade_informada": _numero(
                    item.quantidade_informada
                ),
                "unidade_informada": item.unidade_informada,
                "fator_conversao": _numero(
                    item.fator_conversao
                ),
                "deposito_origem_id": item.deposito_origem_id,
                "gaveta_origem_id": item.gaveta_origem_id,
                "lote_origem_id": item.lote_origem_id,
                "deposito_destino_id": item.deposito_destino_id,
                "gaveta_destino_id": item.gaveta_destino_id,
                "lote_destino_id": item.lote_destino_id,
                "custo_unitario": _numero(
                    item.custo_unitario
                ),
                "valor_total": _numero(
                    item.valor_total
                ),
                "observacao": item.observacao,
            }
            for item in itens
        ],
    }


@router.get("/tipos-movimento")
def tipos_movimento(
    _: User = Depends(get_current_user),
):
    return sorted(MOVIMENTOS_VALIDOS)


@router.post("/movimentar")
def movimentar(
    dados: MovimentoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    usuario_id = current_user.id

    # A autenticaÃƒÂ§ÃƒÂ£o jÃƒÂ¡ realizou uma leitura usando
    # esta sessÃƒÂ£o. Encerramos essa transaÃƒÂ§ÃƒÂ£o somente
    # de leitura antes de abrir a transaÃƒÂ§ÃƒÂ£o do estoque.
    db.rollback()

    try:
        documento = movimentar_estoque(
            db,
            tipo_movimento=dados.tipo_movimento,
            usuario_id=usuario_id,
            itens=[
                item.model_dump(
                    exclude_none=True
                )
                for item in dados.itens
            ],
            origem_modulo=dados.origem_modulo,
            documento_origem_id=dados.documento_origem_id,
            referencia_externa=dados.referencia_externa,
            observacao=dados.observacao,
        )

        return {
            "success": True,
            "message": (
                f"MovimentaÃƒÂ§ÃƒÂ£o {documento.numero} "
                "contabilizada com sucesso."
            ),
            "documento": _serializar_documento(
                db,
                documento,
            ),
        }

    except EstoqueErro as erro:
        raise HTTPException(
            status_code=400,
            detail=str(erro),
        )


@router.post(
    "/documentos/{documento_id}/estornar"
)
def estornar(
    documento_id: str,
    dados: EstornoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    usuario_id = current_user.id

    db.rollback()

    try:
        documento = estornar_documento(
            db,
            documento_id=documento_id,
            usuario_id=usuario_id,
            motivo=dados.motivo,
        )

        return {
            "success": True,
            "message": (
                f"Documento {documento.referencia_externa} "
                f"estornado atravÃƒÂ©s de "
                f"{documento.numero}."
            ),
            "documento": _serializar_documento(
                db,
                documento,
            ),
        }

    except EstoqueErro as erro:
        raise HTTPException(
            status_code=400,
            detail=str(erro),
        )


@router.get("/saldos")
def listar_saldos(
    produto_id: str | None = None,
    deposito_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(
            EstoqueSaldo,
            Produto,
        )
        .join(
            Produto,
            Produto.id
            == EstoqueSaldo.produto_id,
        )
        .order_by(
            Produto.nome,
            EstoqueSaldo.deposito_id,
        )
    )

    if produto_id:
        stmt = stmt.where(
            EstoqueSaldo.produto_id
            == produto_id
        )

    if deposito_id:
        stmt = stmt.where(
            EstoqueSaldo.deposito_id
            == deposito_id
        )

    registros = db.execute(stmt).all()

    return [
        {
            "id": saldo.id,
            "produto_id": saldo.produto_id,
            "produto_codigo": produto.codigo,
            "produto_nome": produto.nome,
            "deposito_id": saldo.deposito_id,
            "gaveta_id": saldo.gaveta_id or None,
            "lote_id": saldo.lote_id or None,
            "tipo_estoque": saldo.tipo_estoque,
            "quantidade": _numero(
                saldo.quantidade
            ),
            "quantidade_reservada": _numero(
                saldo.quantidade_reservada
            ),
            "quantidade_disponivel": _numero(
                saldo.quantidade
                - saldo.quantidade_reservada
            ),
            "custo_medio": _numero(
                saldo.custo_medio
            ),
            "valor_total": _numero(
                saldo.valor_total
            ),
        }
        for saldo, produto in registros
    ]


@router.get("/documentos")
def listar_documentos(
    limit: int = 100,
    origem_modulo: str | None = None,
    documento_origem_id: str | None = None,
    referencia_externa: str | None = None,
    tipo_movimento: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = max(
        1,
        min(limit, 500),
    )

    stmt = select(
        EstoqueDocumento
    )

    if origem_modulo:
        stmt = stmt.where(
            EstoqueDocumento.origem_modulo
            == origem_modulo.strip().lower()
        )

    if documento_origem_id:
        stmt = stmt.where(
            EstoqueDocumento.documento_origem_id
            == documento_origem_id.strip()
        )

    if referencia_externa:
        stmt = stmt.where(
            EstoqueDocumento.referencia_externa
            == referencia_externa.strip()
        )

    if tipo_movimento:
        stmt = stmt.where(
            EstoqueDocumento.tipo_movimento
            == tipo_movimento.strip().upper()
        )

    if status:
        stmt = stmt.where(
            EstoqueDocumento.status
            == status.strip().lower()
        )

    documentos = db.scalars(
        stmt
        .order_by(
            EstoqueDocumento.data_documento.desc()
        )
        .limit(limit)
    ).all()

    return [
        _serializar_documento(
            db,
            documento,
        )
        for documento in documentos
    ]


@router.get("/documentos/{documento_id}")
def obter_documento(
    documento_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    documento = db.get(
        EstoqueDocumento,
        documento_id,
    )

    if documento is None:
        raise HTTPException(
            status_code=404,
            detail="Documento de estoque nÃƒÂ£o encontrado.",
        )

    return _serializar_documento(
        db,
        documento,
    )