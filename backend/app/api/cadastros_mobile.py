from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.entities import preparar_dados, serializar
from app.api.users import exigir_admin
from app.db.database import get_db
from app.models import (
    CadastroMobilePendente,
    Deposito,
    Gaveta,
    Produto,
    Setor,
    User,
)
from app.services.auditoria_erp import registrar_auditoria


router = APIRouter(
    prefix="/api/cadastros-mobile",
    tags=["Cadastros mobile"],
)

TIPOS = {
    "PRODUTO": Produto,
    "DEPOSITO": Deposito,
    "SETOR": Setor,
    "GAVETA": Gaveta,
}

CAMPOS = {
    "PRODUTO": {
        "codigo_referencia", "nome", "setor_id", "deposito_id", "maquina_id",
        "gaveta_id", "unidade", "unidade_alt", "fator_conversao",
        "estoque_minimo", "custo_unitario", "venda", "foto_url",
    },
    "DEPOSITO": {"numero", "nome", "setor_id", "descricao"},
    "SETOR": {
        "nome", "descricao", "cor", "icon", "controla_validade",
        "tem_aba_mobile", "permite_inventario",
    },
    "GAVETA": {"codigo", "descricao", "deposito_id"},
}


class CriarSolicitacao(BaseModel):
    tipo: Literal["PRODUTO", "DEPOSITO", "SETOR", "GAVETA"]
    dados: dict[str, Any]
    imagem_url: str | None = None


class AprovarSolicitacao(BaseModel):
    dados: dict[str, Any] | None = None


class RejeitarSolicitacao(BaseModel):
    motivo: str = Field(min_length=2, max_length=2000)


def _nome_usuario(user: User) -> str:
    return user.display_name or user.username


def _serializar_solicitacao(item: CadastroMobilePendente) -> dict[str, Any]:
    return serializar(item)


def _limpar_dados(tipo: str, dados: dict[str, Any], imagem_url: str | None = None):
    permitidos = CAMPOS[tipo]
    limpos = {chave: valor for chave, valor in dados.items() if chave in permitidos}
    if tipo == "PRODUTO":
        limpos.pop("quantidade", None)
        for campo in ("fator_conversao", "estoque_minimo", "custo_unitario"):
            valor = limpos.get(campo)
            if valor in (None, ""):
                limpos[campo] = 0
            else:
                try:
                    limpos[campo] = float(str(valor).replace(",", "."))
                except ValueError as exc:
                    raise HTTPException(400, f"Valor inválido em {campo}.") from exc
        if imagem_url:
            limpos["foto_url"] = imagem_url
    return limpos


def _texto(valor: Any) -> str:
    return str(valor or "").strip()


def _validar_relacoes(db: Session, tipo: str, dados: dict[str, Any]):
    if tipo == "PRODUTO":
        if not _texto(dados.get("nome")) or not _texto(dados.get("setor_id")):
            raise HTTPException(400, "Nome e setor são obrigatórios para o produto.")
        if not db.get(Setor, dados["setor_id"]):
            raise HTTPException(400, "Setor informado não existe.")
        if dados.get("deposito_id") and not db.get(Deposito, dados["deposito_id"]):
            raise HTTPException(400, "Depósito informado não existe.")
        if dados.get("gaveta_id") and not db.get(Gaveta, dados["gaveta_id"]):
            raise HTTPException(400, "Gaveta informada não existe.")
    elif tipo == "DEPOSITO":
        if not (_texto(dados.get("numero")) or _texto(dados.get("nome"))):
            raise HTTPException(400, "Informe o número ou nome do depósito.")
        if dados.get("setor_id") and not db.get(Setor, dados["setor_id"]):
            raise HTTPException(400, "Setor informado não existe.")
    elif tipo == "SETOR" and not _texto(dados.get("nome")):
        raise HTTPException(400, "Nome do setor é obrigatório.")
    elif tipo == "GAVETA":
        if not _texto(dados.get("codigo")):
            raise HTTPException(400, "Código da gaveta é obrigatório.")
        if dados.get("deposito_id") and not db.get(Deposito, dados["deposito_id"]):
            raise HTTPException(400, "Depósito informado não existe.")


def _validar_duplicidade(db: Session, tipo: str, dados: dict[str, Any]):
    if tipo == "PRODUTO":
        nome = _texto(dados.get("nome"))
        referencia = _texto(dados.get("codigo_referencia"))
        condicoes = [func.lower(Produto.nome) == nome.lower()]
        if referencia:
            condicoes.append(func.lower(Produto.codigo_referencia) == referencia.lower())
        for condicao in condicoes:
            if db.scalar(select(Produto.id).where(condicao).limit(1)):
                raise HTTPException(409, "Já existe um produto com o mesmo nome ou referência.")
    elif tipo == "SETOR":
        valor = _texto(dados.get("nome"))
        if db.scalar(select(Setor.id).where(func.lower(Setor.nome) == valor.lower()).limit(1)):
            raise HTTPException(409, "Já existe um setor com esse nome.")
    elif tipo == "GAVETA":
        valor = _texto(dados.get("codigo"))
        if db.scalar(select(Gaveta.id).where(func.lower(Gaveta.codigo) == valor.lower()).limit(1)):
            raise HTTPException(409, "Já existe uma gaveta com esse código.")
    else:
        numero = _texto(dados.get("numero"))
        nome = _texto(dados.get("nome"))
        condicao = func.lower(Deposito.numero) == numero.lower() if numero else func.lower(Deposito.nome) == nome.lower()
        if db.scalar(select(Deposito.id).where(condicao).limit(1)):
            raise HTTPException(409, "Já existe um depósito com esse número ou nome.")


def _proximo_codigo_produto(db: Session) -> str:
    maior = 0
    for codigo in db.scalars(select(Produto.codigo)).all():
        encontrado = re.search(r"(\d+)\s*$", str(codigo or ""))
        if encontrado:
            maior = max(maior, int(encontrado.group(1)))
    return f"P{maior + 1:04d}"


@router.get("")
def listar(
    status: Literal["PENDENTE", "APROVADO", "REJEITADO"] | None = Query(None),
    _: User = Depends(exigir_admin),
    db: Session = Depends(get_db),
):
    stmt = select(CadastroMobilePendente)
    if status:
        stmt = stmt.where(CadastroMobilePendente.status == status)
    itens = db.scalars(stmt.order_by(CadastroMobilePendente.created_date.desc())).all()
    return [_serializar_solicitacao(item) for item in itens]


@router.get("/contador")
def contador(_: User = Depends(exigir_admin), db: Session = Depends(get_db)):
    total = db.scalar(
        select(func.count()).select_from(CadastroMobilePendente).where(
            CadastroMobilePendente.status == "PENDENTE"
        )
    ) or 0
    return {"pendentes": total}


@router.post("")
def criar(
    requisicao: CriarSolicitacao,
    current_user: User = Depends(exigir_admin),
    db: Session = Depends(get_db),
):
    dados = _limpar_dados(requisicao.tipo, requisicao.dados, requisicao.imagem_url)
    _validar_relacoes(db, requisicao.tipo, dados)
    item = CadastroMobilePendente(
        tipo=requisicao.tipo,
        dados=dados,
        imagem_url=dados.get("foto_url") if requisicao.tipo == "PRODUTO" else None,
        status="PENDENTE",
        created_by_id=current_user.id,
        solicitante_nome=_nome_usuario(current_user),
    )
    db.add(item)
    db.flush()
    registrar_auditoria(
        db, usuario=current_user, acao="solicitar", entidade="CadastroMobilePendente",
        registro_id=item.id, depois=_serializar_solicitacao(item),
    )
    db.commit()
    db.refresh(item)
    return _serializar_solicitacao(item)


@router.post("/{item_id}/aprovar")
def aprovar(
    item_id: str,
    requisicao: AprovarSolicitacao,
    current_user: User = Depends(exigir_admin),
    db: Session = Depends(get_db),
):
    item = db.get(CadastroMobilePendente, item_id)
    if not item:
        raise HTTPException(404, "Solicitação não encontrada.")
    if item.status != "PENDENTE":
        raise HTTPException(409, "Esta solicitação já foi analisada.")
    dados = _limpar_dados(item.tipo, requisicao.dados or item.dados, item.imagem_url)
    _validar_relacoes(db, item.tipo, dados)
    _validar_duplicidade(db, item.tipo, dados)
    model = TIPOS[item.tipo]
    dados_limpos = preparar_dados(model, dados)
    if item.tipo == "PRODUTO":
        dados_limpos["codigo"] = _proximo_codigo_produto(db)
        dados_limpos.pop("quantidade", None)
    registro = model(**dados_limpos)
    registro.created_by_id = current_user.id
    db.add(registro)
    try:
        db.flush()
        registrar_auditoria(
            db, usuario=current_user, acao="criar", entidade=model.__name__,
            registro_id=registro.id, depois=serializar(registro),
            detalhe=f"Aprovado pela solicitação mobile {item.id}",
        )
        item.status = "APROVADO"
        item.dados = dados
        item.registro_criado_id = registro.id
        item.analisado_por_id = current_user.id
        item.analisado_por_nome = _nome_usuario(current_user)
        item.analisado_em = datetime.now(timezone.utc)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Não foi possível aprovar por conflito com um cadastro existente.") from exc
    db.refresh(item)
    return {"solicitacao": _serializar_solicitacao(item), "registro": serializar(registro)}


@router.post("/{item_id}/rejeitar")
def rejeitar(
    item_id: str,
    requisicao: RejeitarSolicitacao,
    current_user: User = Depends(exigir_admin),
    db: Session = Depends(get_db),
):
    item = db.get(CadastroMobilePendente, item_id)
    if not item:
        raise HTTPException(404, "Solicitação não encontrada.")
    if item.status != "PENDENTE":
        raise HTTPException(409, "Esta solicitação já foi analisada.")
    item.status = "REJEITADO"
    item.motivo_rejeicao = requisicao.motivo.strip()
    item.analisado_por_id = current_user.id
    item.analisado_por_nome = _nome_usuario(current_user)
    item.analisado_em = datetime.now(timezone.utc)
    registrar_auditoria(
        db, usuario=current_user, acao="rejeitar", entidade="CadastroMobilePendente",
        registro_id=item.id, depois=_serializar_solicitacao(item),
    )
    db.commit()
    db.refresh(item)
    return _serializar_solicitacao(item)
