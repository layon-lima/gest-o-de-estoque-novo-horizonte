from __future__ import annotations

import json
from collections.abc import Iterable

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Produto, User


VALID_PAGE_KEYS = frozenset(
    {
        "dashboard",
        "movimentacoes",
        "abastecimento",
        "pesagem",
        "aplicacao",
        "cadastros",
        "relatorios",
        "inventario",
    }
)


ENTITY_READ_PAGES = {
    "Abastecimento": {"abastecimento", "relatorios"},
    "AnoSafra": {"cadastros", "aplicacao", "relatorios"},
    "Cultura": {"cadastros", "aplicacao", "relatorios"},
    "Deposito": {
        "dashboard",
        "movimentacoes",
        "abastecimento",
        "aplicacao",
        "cadastros",
        "inventario",
        "relatorios",
    },
    "Gaveta": {
        "dashboard",
        "movimentacoes",
        "cadastros",
        "inventario",
        "relatorios",
    },
    "Inventario": {"inventario", "relatorios"},
    "InventarioItem": {"inventario", "relatorios"},
    "Lavoura": {"cadastros", "aplicacao", "relatorios"},
    "Lote": {
        "dashboard",
        "movimentacoes",
        "abastecimento",
        "aplicacao",
        "cadastros",
        "inventario",
        "relatorios",
    },
    "Maquina": {
        "dashboard",
        "movimentacoes",
        "abastecimento",
        "cadastros",
        "inventario",
        "relatorios",
    },
    "OrdemServicoAplicacao": {"aplicacao", "relatorios"},
    "Pagamento": {"pesagem", "relatorios"},
    "PedidoPesagem": {"pesagem", "relatorios"},
    "Pessoa": {"movimentacoes", "pesagem", "cadastros", "relatorios"},
    "Produto": {
        "dashboard",
        "movimentacoes",
        "abastecimento",
        "pesagem",
        "aplicacao",
        "cadastros",
        "inventario",
        "relatorios",
    },
    "Setor": {
        "dashboard",
        "movimentacoes",
        "abastecimento",
        "aplicacao",
        "cadastros",
        "inventario",
        "relatorios",
    },
    "TicketPesagem": {"pesagem", "relatorios"},
    "Veiculo": {"pesagem", "cadastros", "relatorios"},
}


ENTITY_WRITE_PAGES = {
    "Abastecimento": {"abastecimento"},
    "AnoSafra": {"cadastros"},
    "Cultura": {"cadastros"},
    "Deposito": {"cadastros"},
    "Gaveta": {"cadastros"},
    "Inventario": {"inventario"},
    "InventarioItem": {"inventario"},
    "Lavoura": {"cadastros"},
    "Lote": set(),
    "Maquina": {"cadastros"},
    "OrdemServicoAplicacao": {"aplicacao"},
    "Pagamento": {"pesagem"},
    "PedidoPesagem": {"pesagem"},
    "Pessoa": {"cadastros"},
    "Produto": {"cadastros"},
    "Setor": {"cadastros"},
    "TicketPesagem": {"pesagem"},
    "Veiculo": {"cadastros"},
}


MOBILE_SECTOR_READ_ENTITIES = frozenset(
    {
        "Deposito",
        "Gaveta",
        "Lote",
        "Maquina",
        "Pessoa",
        "Produto",
        "Setor",
    }
)


STOCK_READ_PAGES = frozenset(
    {
        "dashboard",
        "movimentacoes",
        "abastecimento",
        "pesagem",
        "aplicacao",
        "cadastros",
        "inventario",
        "relatorios",
    }
)


ORIGIN_PAGE = {
    "abastecimento": "abastecimento",
    "aplicacao": "aplicacao",
    "inventario": "inventario",
    "pesagem": "pesagem",
    "movimentacoes": "movimentacoes",
    "nfe_manual": "movimentacoes",
    "manual": "movimentacoes",
}


def _json_list(valor):
    if valor is None:
        return None

    if isinstance(valor, list):
        return [
            str(item)
            for item in valor
        ]

    try:
        parsed = json.loads(valor)
    except Exception:
        return []

    if not isinstance(parsed, list):
        return []

    return [
        str(item)
        for item in parsed
    ]


def paginas_usuario(user: User) -> set[str] | None:
    if user.role == "admin":
        return None

    paginas = _json_list(
        user.paginas_permitidas
    )

    if paginas is None:
        # Compatibilidade com usuários antigos:
        # permissões ainda não configuradas = acesso total.
        return None

    return {
        pagina
        for pagina in paginas
        if pagina in VALID_PAGE_KEYS
    }


def paginas_publicas(valor):
    paginas = _json_list(valor)

    if paginas is None:
        return None

    return [
        pagina
        for pagina in paginas
        if pagina in VALID_PAGE_KEYS
    ]


def setores_mobile_ids(user: User) -> set[str]:
    setores = _json_list(
        user.setores_permitidos
    )

    return {
        setor_id
        for setor_id in (setores or [])
        if setor_id
    }


def tem_pagina(
    user: User,
    pagina: str,
) -> bool:
    if user.role == "admin":
        return True

    paginas = paginas_usuario(user)

    if paginas is None:
        return True

    return pagina in paginas


def tem_alguma_pagina(
    user: User,
    paginas: Iterable[str],
) -> bool:
    if user.role == "admin":
        return True

    permitidas = paginas_usuario(user)

    if permitidas is None:
        return True

    return bool(
        set(paginas)
        & permitidas
    )


def exigir_pagina(
    user: User,
    pagina: str,
):
    if tem_pagina(user, pagina):
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "Usuário sem permissão para "
            f"acessar o módulo '{pagina}'."
        ),
    )


def exigir_alguma_pagina(
    user: User,
    paginas: Iterable[str],
):
    paginas = set(paginas)

    if tem_alguma_pagina(
        user,
        paginas,
    ):
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "Usuário sem permissão para "
            "executar esta operação."
        ),
    )


def exigir_confirmacao_abastecimento(
    user: User,
):
    exigir_pagina(
        user,
        "abastecimento",
    )

    if (
        user.role == "admin"
        or user.pode_confirmar_abastecimento
        is True
    ):
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "Usuário sem permissão para "
            "confirmar a baixa de abastecimento."
        ),
    )


def exigir_leitura_entidade(
    user: User,
    entidade: str,
):
    paginas = ENTITY_READ_PAGES.get(
        entidade,
        set(),
    )

    if tem_alguma_pagina(
        user,
        paginas,
    ):
        return

    if (
        entidade
        in MOBILE_SECTOR_READ_ENTITIES
        and setores_mobile_ids(user)
    ):
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "Usuário sem permissão para "
            f"consultar '{entidade}'."
        ),
    )


def exigir_mutacao_entidade(
    user: User,
    entidade: str,
):
    paginas = ENTITY_WRITE_PAGES.get(
        entidade,
        set(),
    )

    if paginas and tem_alguma_pagina(
        user,
        paginas,
    ):
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "Usuário sem permissão para "
            f"alterar '{entidade}'."
        ),
    )


def acesso_apenas_mobile_entidade(
    user: User,
    entidade: str,
) -> bool:
    if user.role == "admin":
        return False

    paginas = ENTITY_READ_PAGES.get(
        entidade,
        set(),
    )

    return (
        not tem_alguma_pagina(
            user,
            paginas,
        )
        and entidade
        in MOBILE_SECTOR_READ_ENTITIES
        and bool(
            setores_mobile_ids(user)
        )
    )


def exigir_leitura_estoque(
    user: User,
):
    if tem_alguma_pagina(
        user,
        STOCK_READ_PAGES,
    ):
        return

    if setores_mobile_ids(user):
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "Usuário sem permissão para "
            "consultar o estoque."
        ),
    )


def acesso_estoque_apenas_mobile(
    user: User,
) -> bool:
    if user.role == "admin":
        return False

    return (
        not tem_alguma_pagina(
            user,
            STOCK_READ_PAGES,
        )
        and bool(
            setores_mobile_ids(user)
        )
    )


def produtos_em_setores_mobile(
    user: User,
    produto_ids: Iterable[str],
    db: Session,
) -> bool:
    ids = {
        str(produto_id)
        for produto_id in produto_ids
        if produto_id
    }

    if not ids:
        return False

    setores = setores_mobile_ids(user)

    if not setores:
        return False

    registros = db.execute(
        select(
            Produto.id,
            Produto.setor_id,
        ).where(
            Produto.id.in_(ids)
        )
    ).all()

    if len(registros) != len(ids):
        return False

    return all(
        setor_id in setores
        for _, setor_id
        in registros
    )


def pagina_da_origem(
    origem_modulo: str | None,
) -> str:
    origem = str(
        origem_modulo or ""
    ).strip().lower()

    return ORIGIN_PAGE.get(
        origem,
        "movimentacoes",
    )


def exigir_origem_operacional(
    user: User,
    origem_modulo: str | None,
):
    pagina = pagina_da_origem(
        origem_modulo
    )

    if pagina == "abastecimento":
        exigir_confirmacao_abastecimento(
            user
        )
        return

    exigir_pagina(
        user,
        pagina,
    )


def exigir_acao_estoque_mobile(
    user: User,
    acao: str,
):
    if user.role == "admin":
        return

    permissoes = {
        "baixar": user.pode_baixar_mobile,
        "mudar_gaveta": user.pode_mudar_gaveta_mobile,
        "mudar_deposito": user.pode_mudar_deposito_mobile,
    }

    if permissoes.get(acao) is True:
        return

    nomes = {
        "baixar": "dar baixa",
        "mudar_gaveta": "mudar gaveta",
        "mudar_deposito": "mudar depósito",
    }

    raise HTTPException(
        status_code=403,
        detail=(
            "Usuário sem permissão para "
            f"{nomes.get(acao, 'executar esta ação')} "
            "pelo celular."
        ),
    )
