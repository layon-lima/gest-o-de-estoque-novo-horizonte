import unittest
from decimal import Decimal
from unittest.mock import MagicMock

from fastapi import HTTPException

from app.api.entities import (
    _decimal_custo_produto,
    _sincronizar_custo_produto_saldos,
)
from app.models import EstoqueSaldo


class CustoProdutoSaldoTest(unittest.TestCase):
    def test_alteracao_de_custo_recalcula_todos_os_saldos(self):
        db = MagicMock()

        saldo_a = EstoqueSaldo(
            id="saldo-a",
            produto_id="produto-1",
            deposito_id="dep-1",
            gaveta_id="",
            lote_id="",
            tipo_estoque="livre",
            quantidade=Decimal("10.000"),
            quantidade_reservada=Decimal("0"),
            custo_medio=Decimal("5.000000"),
            valor_total=Decimal("50.00"),
        )
        saldo_b = EstoqueSaldo(
            id="saldo-b",
            produto_id="produto-1",
            deposito_id="dep-2",
            gaveta_id="",
            lote_id="",
            tipo_estoque="livre",
            quantidade=Decimal("2.500"),
            quantidade_reservada=Decimal("0"),
            custo_medio=Decimal("5.000000"),
            valor_total=Decimal("12.50"),
        )

        db.scalars.return_value.all.return_value = [
            saldo_a,
            saldo_b,
        ]

        alterados = _sincronizar_custo_produto_saldos(
            db,
            "produto-1",
            Decimal("8.75"),
        )

        self.assertEqual(alterados, 2)
        self.assertEqual(
            saldo_a.custo_medio,
            Decimal("8.750000"),
        )
        self.assertEqual(
            saldo_a.valor_total,
            Decimal("87.50"),
        )
        self.assertEqual(
            saldo_b.custo_medio,
            Decimal("8.750000"),
        )
        self.assertEqual(
            saldo_b.valor_total,
            Decimal("21.88"),
        )

    def test_saldo_zerado_permanece_sem_valor_contabil(self):
        db = MagicMock()
        saldo = EstoqueSaldo(
            id="saldo-zero",
            produto_id="produto-1",
            deposito_id="dep-1",
            gaveta_id="",
            lote_id="",
            tipo_estoque="livre",
            quantidade=Decimal("0"),
            quantidade_reservada=Decimal("0"),
            custo_medio=Decimal("5.000000"),
            valor_total=Decimal("5.00"),
        )
        db.scalars.return_value.all.return_value = [
            saldo,
        ]

        _sincronizar_custo_produto_saldos(
            db,
            "produto-1",
            Decimal("12.34"),
        )

        self.assertEqual(
            saldo.custo_medio,
            Decimal("0"),
        )
        self.assertEqual(
            saldo.valor_total,
            Decimal("0"),
        )

    def test_custo_negativo_e_bloqueado(self):
        with self.assertRaises(HTTPException) as erro:
            _decimal_custo_produto(-1)

        self.assertEqual(
            erro.exception.status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
