from types import SimpleNamespace
import unittest

from app.api.entities import _abastecimento_mesmo_conteudo


class AbastecimentoOfflineTest(unittest.TestCase):
    def test_retry_com_mesmos_dados_e_id_e_idempotente(self):
        existente = SimpleNamespace(
            maquina_id="maq-1",
            produto_id="prod-1",
            quantidade=125.5,
            unidade="l",
            operador="OPERADOR",
            observacao="",
            foto_url="/uploads/foto.jpg",
        )

        dados = {
            "maquina_id": "maq-1",
            "produto_id": "prod-1",
            "quantidade": 125.5,
            "unidade": "l",
            "operador": "OPERADOR",
            "observacao": "",
            "foto_url": "/uploads/foto.jpg",
        }

        self.assertTrue(
            _abastecimento_mesmo_conteudo(
                existente,
                dados,
            )
        )

    def test_retry_com_dados_diferentes_nao_e_aceito(self):
        existente = SimpleNamespace(
            maquina_id="maq-1",
            produto_id="prod-1",
            quantidade=100.0,
            unidade="l",
            operador="OPERADOR",
            observacao="",
            foto_url="",
        )

        dados = {
            "maquina_id": "maq-1",
            "produto_id": "prod-1",
            "quantidade": 110.0,
            "unidade": "l",
            "operador": "OPERADOR",
            "observacao": "",
            "foto_url": "",
        }

        self.assertFalse(
            _abastecimento_mesmo_conteudo(
                existente,
                dados,
            )
        )


if __name__ == "__main__":
    unittest.main()
