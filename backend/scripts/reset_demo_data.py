
from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, select, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import SessionLocal, engine
from app.models import (
    AnoSafra,
    Cultura,
    Deposito,
    Gaveta,
    Lavoura,
    Maquina,
    Pessoa,
    Produto,
    Setor,
    User,
    Veiculo,
)
from app.services.motor_estoque import movimentar_estoque


PRESERVAR_TABELAS = {
    "users",
    "alembic_version",
}

UPLOAD_DEMO_DIR = BACKEND_DIR / "uploads" / "demo_produtos"


def json_safe(value: Any):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    return value


def backup_dados(tabelas: list[str]) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = PROJECT_DIR / f"BACKUP_ANTES_DADOS_DEMO_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    payload: dict[str, list[dict[str, Any]]] = {}

    with engine.connect() as conn:
        for tabela in tabelas:
            rows = conn.execute(
                text(f'SELECT * FROM "{tabela}"')
            ).mappings().all()

            payload[tabela] = [
                {
                    chave: json_safe(valor)
                    for chave, valor in row.items()
                }
                for row in rows
            ]

    arquivo = backup_dir / "dados_anteriores.json"
    arquivo.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    (backup_dir / "LEIA-ME.txt").write_text(
        "Backup automático criado antes de limpar os dados operacionais.\n"
        "A tabela users e o login foram preservados no banco e não fazem parte "
        "deste backup porque não serão apagados.\n",
        encoding="utf-8",
    )

    return backup_dir


def listar_tabelas_operacionais() -> list[str]:
    inspector = inspect(engine)
    return sorted(
        tabela
        for tabela in inspector.get_table_names(schema="public")
        if tabela not in PRESERVAR_TABELAS
    )


def limpar_dados_operacionais(tabelas: list[str]) -> None:
    if not tabelas:
        return

    nomes = ", ".join(f'"{nome}"' for nome in tabelas)

    with engine.begin() as conn:
        conn.execute(
            text(
                f"TRUNCATE TABLE {nomes} "
                "RESTART IDENTITY CASCADE"
            )
        )


def slug(texto: str) -> str:
    base = unicodedata.normalize("NFKD", texto)
    base = "".join(
        caractere
        for caractere in base
        if not unicodedata.combining(caractere)
    )
    base = re.sub(r"[^a-zA-Z0-9]+", "-", base).strip("-").lower()
    return base or "produto"


def criar_svg_produto(
    nome: str,
    categoria: str,
    cor: str,
    arquivo: Path,
) -> None:
    nome_xml = html.escape(nome)
    categoria_xml = html.escape(categoria.upper())

    icones = {
        "ADUBO": '''
          <path d="M195 135h250l34 64-28 134H189l-28-134 34-64Z"
                fill="#ffffff" fill-opacity=".92"/>
          <path d="M245 135c22-54 128-54 150 0"
                fill="none" stroke="#ffffff" stroke-width="18"
                stroke-linecap="round"/>
          <circle cx="270" cy="232" r="11" fill="{cor}"/>
          <circle cx="320" cy="205" r="12" fill="{cor}"/>
          <circle cx="365" cy="248" r="10" fill="{cor}"/>
        ''',
        "ALMOXARIFADO": '''
          <rect x="185" y="145" width="270" height="182" rx="28"
                fill="#ffffff" fill-opacity=".92"/>
          <path d="M185 210h270M275 145v182M365 145v182"
                stroke="{cor}" stroke-width="11" opacity=".72"/>
          <circle cx="230" cy="180" r="13" fill="{cor}"/>
          <circle cx="320" cy="180" r="13" fill="{cor}"/>
          <circle cx="410" cy="180" r="13" fill="{cor}"/>
        ''',
        "DEFENSIVOS": '''
          <path d="M266 119h108v55l39 42v112c0 22-18 40-40 40H267
                   c-22 0-40-18-40-40V216l39-42v-55Z"
                fill="#ffffff" fill-opacity=".93"/>
          <rect x="280" y="235" width="80" height="62" rx="12"
                fill="{cor}" opacity=".82"/>
          <path d="M288 119h64" stroke="{cor}" stroke-width="12"
                stroke-linecap="round"/>
        ''',
        "SEMENTES": '''
          <ellipse cx="272" cy="236" rx="55" ry="90"
                   transform="rotate(-26 272 236)"
                   fill="#ffffff" fill-opacity=".93"/>
          <ellipse cx="369" cy="231" rx="55" ry="90"
                   transform="rotate(24 369 231)"
                   fill="#ffffff" fill-opacity=".93"/>
          <path d="M320 335c0-68 6-116 0-177"
                stroke="{cor}" stroke-width="12"
                stroke-linecap="round"/>
        ''',
    }

    icon = icones.get(categoria, icones["ALMOXARIFADO"]).format(cor=cor)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"
viewBox="0 0 640 420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{cor}" stop-opacity=".96"/>
      <stop offset="1" stop-color="{cor}" stop-opacity=".64"/>
    </linearGradient>
  </defs>

  <rect width="640" height="420" rx="34" fill="#f6f8f7"/>
  <rect x="26" y="26" width="588" height="368" rx="28" fill="url(#g)"/>
  <circle cx="536" cy="84" r="78" fill="#ffffff" fill-opacity=".10"/>
  <circle cx="92" cy="334" r="110" fill="#ffffff" fill-opacity=".08"/>

  {icon}

  <text x="42" y="54"
        font-family="Arial, Helvetica, sans-serif"
        font-size="21"
        font-weight="700"
        fill="#ffffff"
        fill-opacity=".86">{categoria_xml}</text>

  <rect x="40" y="343" width="560" height="35" rx="12"
        fill="#ffffff" fill-opacity=".92"/>
  <text x="320" y="367"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="20"
        font-weight="800"
        fill="#17372e">{nome_xml}</text>
</svg>'''

    arquivo.write_text(svg, encoding="utf-8")


def gravar_imagens(produtos: list[dict[str, Any]]) -> None:
    UPLOAD_DEMO_DIR.mkdir(parents=True, exist_ok=True)

    for item in UPLOAD_DEMO_DIR.iterdir():
        if item.is_file():
            item.unlink()

    for produto in produtos:
        criar_svg_produto(
            produto["nome"],
            produto["categoria"],
            produto["cor"],
            UPLOAD_DEMO_DIR / produto["imagem"],
        )


def seed_cadastros():
    setores_def = [
        {
            "chave": "ADUBO",
            "nome": "ADUBO",
            "descricao": "Fertilizantes e corretivos agrícolas - dados demonstrativos.",
            "cor": "#109B6D",
            "icon": "fertilizer",
            "controla_validade": False,
            "tem_aba_mobile": True,
            "permite_inventario": True,
        },
        {
            "chave": "ALMOXARIFADO",
            "nome": "ALMOXARIFADO",
            "descricao": "Peças, filtros, ferramentas e materiais de manutenção - dados demonstrativos.",
            "cor": "#2B73D2",
            "icon": "package",
            "controla_validade": False,
            "tem_aba_mobile": True,
            "permite_inventario": True,
        },
        {
            "chave": "DEFENSIVOS",
            "nome": "DEFENSIVOS",
            "descricao": "Defensivos agrícolas com controle de validade - dados demonstrativos.",
            "cor": "#E99016",
            "icon": "flask",
            "controla_validade": True,
            "tem_aba_mobile": True,
            "permite_inventario": True,
        },
        {
            "chave": "SEMENTES",
            "nome": "SEMENTES",
            "descricao": "Sementes para plantio com controle de validade - dados demonstrativos.",
            "cor": "#7453C7",
            "icon": "wheat",
            "controla_validade": True,
            "tem_aba_mobile": True,
            "permite_inventario": True,
        },
    ]

    depositos_def = [
        ("D01", "GALPÃO DE ADUBOS", "ADUBO"),
        ("D02", "ALMOXARIFADO CENTRAL", "ALMOXARIFADO"),
        ("D03", "DEPÓSITO DE DEFENSIVOS", "DEFENSIVOS"),
        ("D04", "ARMAZÉM DE SEMENTES", "SEMENTES"),
    ]

    gavetas_def = [
        ("BAIA 01", "Área frontal - fertilizantes", "D01"),
        ("BAIA 02", "Área central - fertilizantes", "D01"),
        ("BAIA 03", "Área lateral - fertilizantes", "D01"),
        ("GAVETA 01", "Peças de giro rápido", "D02"),
        ("GAVETA 02", "Fixadores e ferragens", "D02"),
        ("PRATELEIRA A1", "Lubrificantes", "D02"),
        ("PRATELEIRA A2", "Abrasivos e ferramentas", "D02"),
        ("PRATELEIRA B1", "EPIs e consumíveis", "D02"),
        ("ARMÁRIO D01", "Herbicidas", "D03"),
        ("ARMÁRIO D02", "Fungicidas", "D03"),
        ("ARMÁRIO D03", "Inseticidas", "D03"),
        ("BOX 01", "Sementes de soja", "D04"),
        ("BOX 02", "Sementes de milho", "D04"),
        ("BOX 03", "Sementes de cobertura", "D04"),
    ]

    produtos_def = [
        dict(categoria="ADUBO", codigo="AD001", referencia="FERT-UREIA-46",
             nome="UREIA GRANULADA 46-00-00", unidade="KG", minimo=2500, custo=2.78,
             deposito="D01", gaveta="BAIA 01", qtd=12500, cor="#109B6D"),
        dict(categoria="ADUBO", codigo="AD002", referencia="FERT-MAP-1152",
             nome="MAP 11-52-00", unidade="KG", minimo=1800, custo=4.35,
             deposito="D01", gaveta="BAIA 01", qtd=8200, cor="#109B6D"),
        dict(categoria="ADUBO", codigo="AD003", referencia="FERT-KCL-0060",
             nome="KCL 00-00-60", unidade="KG", minimo=2000, custo=3.42,
             deposito="D01", gaveta="BAIA 02", qtd=9600, cor="#109B6D"),
        dict(categoria="ADUBO", codigo="AD004", referencia="FERT-SAM-2100",
             nome="SULFATO DE AMÔNIO", unidade="KG", minimo=1200, custo=2.21,
             deposito="D01", gaveta="BAIA 03", qtd=5400, cor="#109B6D"),
        dict(categoria="ADUBO", codigo="AD005", referencia="FERT-SSP-1800",
             nome="SUPERFOSFATO SIMPLES", unidade="KG", minimo=1000, custo=1.91,
             deposito="D01", gaveta="BAIA 02", qtd=3000, cor="#109B6D"),

        dict(categoria="ALMOXARIFADO", codigo="AL001", referencia="P552050",
             nome="FILTRO DE ÓLEO MOTOR P552050", unidade="UN", minimo=8, custo=48.90,
             deposito="D02", gaveta="GAVETA 01", qtd=24, cor="#2B73D2"),
        dict(categoria="ALMOXARIFADO", codigo="AL002", referencia="6204-ZZ",
             nome="ROLAMENTO 6204 ZZ", unidade="UN", minimo=10, custo=31.40,
             deposito="D02", gaveta="GAVETA 01", qtd=18, cor="#2B73D2"),
        dict(categoria="ALMOXARIFADO", codigo="AL003", referencia="13AV1250",
             nome="CORREIA DO ALTERNADOR 13AV1250", unidade="UN", minimo=10, custo=74.00,
             deposito="D02", gaveta="GAVETA 01", qtd=6, cor="#2B73D2"),
        dict(categoria="ALMOXARIFADO", codigo="AL004", referencia="M10X50-88",
             nome="PARAFUSO SEXTAVADO M10 X 50", unidade="UN", minimo=40, custo=2.15,
             deposito="D02", gaveta="GAVETA 02", qtd=120, cor="#2B73D2"),
        dict(categoria="ALMOXARIFADO", codigo="AL005", referencia="GRAXA-EP2-20",
             nome="GRAXA EP2 BALDE 20 KG", unidade="UN", minimo=4, custo=389.00,
             deposito="D02", gaveta="PRATELEIRA A1", qtd=8, cor="#2B73D2"),
        dict(categoria="ALMOXARIFADO", codigo="AL006", referencia="HLP-68",
             nome="ÓLEO HIDRÁULICO ISO 68", unidade="L", minimo=200, custo=18.90,
             deposito="D02", gaveta="PRATELEIRA A1", qtd=600, cor="#2B73D2"),
        dict(categoria="ALMOXARIFADO", codigo="AL007", referencia="DISCO-115",
             nome="DISCO DE CORTE 4 1/2", unidade="UN", minimo=15, custo=9.80,
             deposito="D02", gaveta="PRATELEIRA A2", qtd=35, cor="#2B73D2"),
        dict(categoria="ALMOXARIFADO", codigo="AL008", referencia="LUVA-NIT-M",
             nome="LUVA NITRÍLICA TAMANHO M", unidade="CX", minimo=6, custo=42.00,
             deposito="D02", gaveta="GAVETA 01", qtd=12, cor="#2B73D2"),

        dict(categoria="DEFENSIVOS", codigo="DF001", referencia="GLIF-480",
             nome="GLIFOSATO 480 SL", unidade="L", minimo=100, custo=24.50,
             deposito="D03", gaveta="ARMÁRIO D01", qtd=450, cor="#E99016",
             validade="2028-05-30"),
        dict(categoria="DEFENSIVOS", codigo="DF002", referencia="24D-806",
             nome="2,4-D AMINA 806 SL", unidade="L", minimo=80, custo=31.20,
             deposito="D03", gaveta="ARMÁRIO D01", qtd=200, cor="#E99016",
             validade="2028-03-15"),
        dict(categoria="DEFENSIVOS", codigo="DF003", referencia="ATRA-500",
             nome="ATRAZINA 500 SC", unidade="L", minimo=60, custo=36.80,
             deposito="D03", gaveta="ARMÁRIO D01", qtd=120, cor="#E99016",
             validade="2027-12-20"),
        dict(categoria="DEFENSIVOS", codigo="DF004", referencia="AZOX-CIPR",
             nome="FUNGICIDA AZOXISTROBINA + CIPROCONAZOL", unidade="L", minimo=30, custo=119.00,
             deposito="D03", gaveta="ARMÁRIO D02", qtd=60, cor="#E99016",
             validade="2028-08-10"),
        dict(categoria="DEFENSIVOS", codigo="DF005", referencia="LAMB-250",
             nome="INSETICIDA LAMBDA-CIALOTRINA", unidade="L", minimo=50, custo=87.50,
             deposito="D03", gaveta="ARMÁRIO D03", qtd=40, cor="#E99016",
             validade="2028-01-25"),

        dict(categoria="SEMENTES", codigo="SM001", referencia="95R95-IPRO",
             nome="SEMENTE SOJA 95R95 IPRO", unidade="SC", minimo=25, custo=540.00,
             deposito="D04", gaveta="BOX 01", qtd=80, cor="#7453C7",
             validade="2027-10-30"),
        dict(categoria="SEMENTES", codigo="SM002", referencia="96R10-IPRO",
             nome="SEMENTE SOJA 96R10 IPRO", unidade="SC", minimo=20, custo=565.00,
             deposito="D04", gaveta="BOX 01", qtd=60, cor="#7453C7",
             validade="2027-11-15"),
        dict(categoria="SEMENTES", codigo="SM003", referencia="AG8700-PRO3",
             nome="SEMENTE MILHO AG 8700 PRO3", unidade="SC", minimo=18, custo=890.00,
             deposito="D04", gaveta="BOX 02", qtd=45, cor="#7453C7",
             validade="2027-08-20"),
        dict(categoria="SEMENTES", codigo="SM004", referencia="DKB360-PRO3",
             nome="SEMENTE MILHO DKB 360 PRO3", unidade="SC", minimo=15, custo=920.00,
             deposito="D04", gaveta="BOX 02", qtd=30, cor="#7453C7",
             validade="2027-09-10"),
        dict(categoria="SEMENTES", codigo="SM005", referencia="BRACHI-RUZ",
             nome="SEMENTE BRACHIARIA RUZIZIENSIS", unidade="SC", minimo=12, custo=310.00,
             deposito="D04", gaveta="BOX 03", qtd=25, cor="#7453C7",
             validade="2027-06-30"),
    ]

    for item in produtos_def:
        item["imagem"] = f'{slug(item["codigo"] + "-" + item["nome"])}.svg'

    gravar_imagens(produtos_def)

    with SessionLocal() as db:
        usuarios = db.scalars(
            select(User)
            .where(User.ativo.is_(True))
            .order_by(User.role.desc(), User.created_date.asc())
        ).all()

        if not usuarios:
            raise RuntimeError(
                "Nenhum usuário ativo encontrado. "
                "O reset preserva usuários, mas precisa de ao menos um usuário ativo."
            )

        ator = next(
            (usuario for usuario in usuarios if usuario.role == "admin"),
            usuarios[0],
        )

        setores: dict[str, Setor] = {}

        for item in setores_def:
            setor = Setor(
                nome=item["nome"],
                descricao=item["descricao"],
                cor=item["cor"],
                icon=item["icon"],
                controla_validade=item["controla_validade"],
                tem_aba_mobile=item["tem_aba_mobile"],
                permite_inventario=item["permite_inventario"],
            )
            db.add(setor)
            db.flush()
            setores[item["chave"]] = setor

        depositos: dict[str, Deposito] = {}

        for numero, nome, setor_chave in depositos_def:
            deposito = Deposito(
                numero=numero,
                nome=nome,
                setor_id=setores[setor_chave].id,
                descricao="Cadastro demonstrativo para testes de interface e estoque.",
            )
            db.add(deposito)
            db.flush()
            depositos[numero] = deposito

        gavetas: dict[str, Gaveta] = {}

        for codigo, descricao, deposito_numero in gavetas_def:
            gaveta = Gaveta(
                codigo=codigo,
                descricao=descricao,
                deposito_id=depositos[deposito_numero].id,
            )
            db.add(gaveta)
            db.flush()
            gavetas[codigo] = gaveta

        db.add_all([
            Pessoa(
                nome="AGRO DEMO INSUMOS LTDA",
                documento="12.345.678/0001-10",
                telefone="(65) 3333-1001",
                cidade="Campo Verde",
                uf="MT",
                is_fornecedor=True,
                observacao="Fornecedor fictício para ambiente de demonstração.",
            ),
            Pessoa(
                nome="PEÇAS CAMPO TESTE LTDA",
                documento="23.456.789/0001-20",
                telefone="(65) 3333-2002",
                cidade="Rondonópolis",
                uf="MT",
                is_fornecedor=True,
                observacao="Fornecedor fictício para ambiente de demonstração.",
            ),
            Pessoa(
                nome="DEFENSIVOS LAB DEMO S/A",
                documento="34.567.890/0001-30",
                telefone="(66) 3333-3003",
                cidade="Primavera do Leste",
                uf="MT",
                is_fornecedor=True,
                observacao="Fornecedor fictício para ambiente de demonstração.",
            ),
            Pessoa(
                nome="SEMENTES HORIZONTE TESTE",
                documento="45.678.901/0001-40",
                telefone="(66) 3333-4004",
                cidade="Sorriso",
                uf="MT",
                is_fornecedor=True,
                observacao="Fornecedor fictício para ambiente de demonstração.",
            ),
        ])

        db.add_all([
            AnoSafra(nome="2026/2027"),
            Cultura(nome="SOJA"),
            Cultura(nome="MILHO"),
            Lavoura(nome="TALHÃO 01", numero="01", hectares=128.5),
            Lavoura(nome="TALHÃO 02", numero="02", hectares=96.0),
            Lavoura(nome="TALHÃO 03", numero="03", hectares=142.7),
        ])

        db.add_all([
            Maquina(
                codigo="TR-01",
                nome="TRATOR JOHN DEERE 7230J",
                descricao="Máquina fictícia para testes.",
            ),
            Maquina(
                codigo="PULV-01",
                nome="PULVERIZADOR UNIPORT 3030",
                descricao="Máquina fictícia para testes.",
            ),
            Maquina(
                codigo="COLH-01",
                nome="COLHEITADEIRA S790",
                descricao="Máquina fictícia para testes.",
            ),
        ])

        db.add_all([
            Veiculo(
                placa="DEM0A01",
                modelo="CAMINHÃO DEMO 6X4",
                cor="BRANCO",
                ano="2025",
                tara=9200,
                capacidade_kg=29000,
                observacao="Veículo fictício para testes.",
            ),
            Veiculo(
                placa="DEM0B02",
                modelo="CAMINHONETE DEMO 4X4",
                cor="PRATA",
                ano="2026",
                tara=2150,
                capacidade_kg=950,
                observacao="Veículo fictício para testes.",
            ),
        ])

        produtos: dict[str, Produto] = {}

        for item in produtos_def:
            produto = Produto(
                codigo=item["codigo"],
                codigo_referencia=item["referencia"],
                nome=item["nome"],
                setor_id=setores[item["categoria"]].id,
                deposito_id=depositos[item["deposito"]].id,
                gaveta_id=gavetas[item["gaveta"]].id,
                quantidade=0,
                unidade=item["unidade"],
                estoque_minimo=item["minimo"],
                custo_unitario=item["custo"],
                venda=False,
                foto_url=f'/uploads/demo_produtos/{item["imagem"]}',
            )
            db.add(produto)
            db.flush()
            produtos[item["codigo"]] = produto

        setores_ids = [setor.id for setor in setores.values()]

        for usuario in usuarios:
            usuario.setores_permitidos = json.dumps(
                setores_ids,
                ensure_ascii=False,
            )

        db.commit()

        # IMPORTANTÍSSIMO:
        # A partir daqui, o motor de estoque NÃO usa esta mesma sessão.
        # Guardamos somente valores simples (strings/números) antes de sair
        # do bloco de cadastro. Isso evita qualquer autobegin do SQLAlchemy.
        ator_id = str(ator.id)
        ator_nome = ator.display_name or ator.username
        usuarios_preservados = len(usuarios)

        produto_meta = {
            codigo: {
                "id": str(produto.id),
                "unidade": str(produto.unidade or "UN"),
            }
            for codigo, produto in produtos.items()
        }

        deposito_ids = {
            numero: str(deposito.id)
            for numero, deposito in depositos.items()
        }

        gaveta_ids = {
            codigo: str(gaveta.id)
            for codigo, gaveta in gavetas.items()
        }

    # Cada chamada ao motor usa uma sessão NOVA, sem leitura anterior.
    # Esse é o mesmo padrão seguro que a API precisa para db.begin().
    for categoria in ["ADUBO", "ALMOXARIFADO", "DEFENSIVOS", "SEMENTES"]:
        itens = []

        for item in produtos_def:
            if item["categoria"] != categoria:
                continue

            movimento = {
                "produto_id": produto_meta[item["codigo"]]["id"],
                "quantidade": Decimal(str(item["qtd"])),
                "unidade": item["unidade"],
                "deposito_destino_id": deposito_ids[item["deposito"]],
                "gaveta_destino_id": gaveta_ids[item["gaveta"]],
                "custo_unitario": Decimal(str(item["custo"])),
                "observacao": "Carga inicial fictícia do ambiente de demonstração.",
            }

            if item.get("validade"):
                movimento["data_validade"] = item["validade"]

            itens.append(movimento)

        with SessionLocal() as estoque_db:
            movimentar_estoque(
                estoque_db,
                tipo_movimento="AJUSTE_POSITIVO",
                usuario_id=ator_id,
                itens=itens,
                origem_modulo="demo",
                referencia_externa=f"DEMO-CARGA-{categoria}",
                observacao=(
                    "Carga inicial fictícia criada automaticamente "
                    "para avaliação visual e funcional do sistema."
                ),
            )

    saidas = [
        ("AD001", "D01", "BAIA 01", 750),
        ("AL001", "D02", "GAVETA 01", 3),
        ("AL007", "D02", "PRATELEIRA A2", 5),
        ("DF001", "D03", "ARMÁRIO D01", 20),
        ("SM001", "D04", "BOX 01", 5),
    ]

    for codigo, deposito_numero, gaveta_codigo, quantidade in saidas:
        meta = produto_meta[codigo]

        with SessionLocal() as estoque_db:
            movimentar_estoque(
                estoque_db,
                tipo_movimento="SAIDA_CONSUMO",
                usuario_id=ator_id,
                itens=[{
                    "produto_id": meta["id"],
                    "quantidade": Decimal(str(quantidade)),
                    "unidade": meta["unidade"],
                    "deposito_origem_id": deposito_ids[deposito_numero],
                    "gaveta_origem_id": gaveta_ids[gaveta_codigo],
                    "observacao": "Consumo fictício para demonstração do histórico.",
                }],
                origem_modulo="demo",
                referencia_externa=f"DEMO-CONSUMO-{codigo}",
                observacao="Movimento fictício para teste do sistema.",
            )

    return {
        "usuarios_preservados": usuarios_preservados,
        "ator": ator_nome,
        "setores": len(setores_def),
        "depositos": len(depositos_def),
        "gavetas": len(gavetas_def),
        "produtos": len(produtos_def),
        "imagens": len(produtos_def),
    }

def main() -> None:
    print("")
    print("=" * 68)
    print(" RESET + DADOS DEMONSTRATIVOS V4 - ESTOQUE NOVO HORIZONTE")
    print("=" * 68)
    print("")
    print("Usuários e logins serão PRESERVADOS.")
    print("Todos os demais dados operacionais serão apagados e substituídos.")
    print("Um backup JSON será criado automaticamente antes da limpeza.")
    print("")

    tabelas = listar_tabelas_operacionais()

    backup_dir = backup_dados(tabelas)
    print(f"[OK] Backup criado em: {backup_dir}")

    limpar_dados_operacionais(tabelas)
    print(f"[OK] {len(tabelas)} tabelas operacionais limpas.")

    resumo = seed_cadastros()

    print("")
    print("=" * 68)
    print(" DADOS DEMONSTRATIVOS CRIADOS COM SUCESSO")
    print("=" * 68)
    print(f"Usuários preservados : {resumo['usuarios_preservados']}")
    print(f"Usuário dos movimentos: {resumo['ator']}")
    print(f"Setores              : {resumo['setores']}")
    print(f"Depósitos            : {resumo['depositos']}")
    print(f"Gavetas/locais       : {resumo['gavetas']}")
    print(f"Produtos             : {resumo['produtos']}")
    print(f"Imagens de produto   : {resumo['imagens']}")
    print("")
    print("TESTE RECOMENDADO NO MOBILE:")
    print("  Setor ALMOXARIFADO -> pesquisar: GAVETA 01")
    print("  Deve retornar vários produtos dessa gaveta.")
    print("")
    print("Atualize a página do navegador para carregar os novos dados.")
    print("")


if __name__ == "__main__":
    main()
