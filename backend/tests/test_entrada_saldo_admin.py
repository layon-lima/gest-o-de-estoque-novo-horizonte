import unittest

from fastapi import HTTPException

from app.api.estoque import (
    MovimentoItemRequest,
    MovimentoRequest,
    _exigir_movimentacao_permitida,
)
from app.models import User
from app.services.regras_movimento import (
    MOVIMENTOS_ENTRADA,
    MOVIMENTOS_VALIDOS,
    DirecaoMovimento,
    obter_regra_movimento,
)


class EntradaSaldoAdminTest(unittest.TestCase):
    def setUp(self):
        self.admin = User(
            id="admin",
            role="admin",
            username="admin",
            display_name="Admin",
        )
        self.comum = User(
            id="user",
            role="user",
            username="user",
            display_name="Usuario",
        )

    def movimento(self, **overrides):
        dados = {
            "tipo_movimento": "ENTRADA_SALDO_ADMIN",
            "origem_modulo": "movimentacoes",
            "observacao": "Carga inicial conferida pelo administrador.",
            "itens": [
                MovimentoItemRequest(
                    produto_id="produto-1",
                    quantidade=10,
                    unidade="un",
                    deposito_destino_id="deposito-1",
                    gaveta_destino_id="gaveta-1",
                )
            ],
        }
        dados.update(overrides)
        return MovimentoRequest(**dados)

    def test_tipo_pertence_ao_motor_oficial_como_entrada(self):
        regra = obter_regra_movimento("ENTRADA_SALDO_ADMIN")
        self.assertEqual(regra.direcao, DirecaoMovimento.ENTRADA)
        self.assertIn("ENTRADA_SALDO_ADMIN", MOVIMENTOS_VALIDOS)
        self.assertIn("ENTRADA_SALDO_ADMIN", MOVIMENTOS_ENTRADA)

    def test_usuario_comum_e_bloqueado_no_backend(self):
        with self.assertRaises(HTTPException) as erro:
            _exigir_movimentacao_permitida(
                self.movimento(),
                self.comum,
                None,
            )
        self.assertEqual(erro.exception.status_code, 403)

    def test_admin_pode_usar_fluxo_de_movimentos(self):
        _exigir_movimentacao_permitida(
            self.movimento(),
            self.admin,
            None,
        )

    def test_documento_fiscal_e_bloqueado(self):
        with self.assertRaises(HTTPException) as erro:
            _exigir_movimentacao_permitida(
                self.movimento(
                    referencia_externa="NF-123"
                ),
                self.admin,
                None,
            )
        self.assertEqual(erro.exception.status_code, 400)

    def test_justificativa_e_obrigatoria(self):
        with self.assertRaises(HTTPException) as erro:
            _exigir_movimentacao_permitida(
                self.movimento(observacao=""),
                self.admin,
                None,
            )
        self.assertEqual(erro.exception.status_code, 400)

    def test_origem_de_estoque_e_bloqueada(self):
        movimento = self.movimento()
        movimento.itens[0].deposito_origem_id = "deposito-antigo"

        with self.assertRaises(HTTPException) as erro:
            _exigir_movimentacao_permitida(
                movimento,
                self.admin,
                None,
            )
        self.assertEqual(erro.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
