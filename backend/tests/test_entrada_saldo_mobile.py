import unittest
from unittest.mock import MagicMock

from fastapi import HTTPException

from app.api.entrada_saldo_mobile import (
    _exigir_permissao_mobile,
    _validar_local,
    _validar_setor_usuario,
)
from app.models import Deposito, Gaveta, Setor, User


class EntradaSaldoMobileTest(unittest.TestCase):
    def usuario(self, *, permitido=False, admin=False):
        return User(
            id="user-1",
            username="teste",
            password_hash="hash",
            display_name="Teste",
            role="admin" if admin else "user",
            pode_entrada_manual_saldo_mobile=permitido,
            setores_permitidos='["setor-1"]',
            ativo=True,
        )

    def test_usuario_sem_permissao_e_bloqueado(self):
        with self.assertRaises(HTTPException) as erro:
            _exigir_permissao_mobile(self.usuario())

        self.assertEqual(erro.exception.status_code, 403)

    def test_usuario_habilitado_pode_usar(self):
        _exigir_permissao_mobile(
            self.usuario(permitido=True)
        )

    def test_admin_pode_usar(self):
        _exigir_permissao_mobile(
            self.usuario(admin=True)
        )

    def test_usuario_so_pode_usar_setor_liberado(self):
        user = self.usuario(permitido=True)

        _validar_setor_usuario(
            user,
            "setor-1",
        )

        with self.assertRaises(HTTPException):
            _validar_setor_usuario(
                user,
                "setor-2",
            )

    def test_gaveta_e_obrigatoria_quando_deposito_tem_gavetas(self):
        db = MagicMock()

        setor = Setor(
            id="setor-1",
            nome="Almoxarifado",
        )
        deposito = Deposito(
            id="dep-1",
            numero="DEP-01",
            setor_id="setor-1",
        )
        gaveta = Gaveta(
            id="gav-1",
            codigo="GAVETA 01",
            deposito_id="dep-1",
        )

        def get(model, item_id):
            if model is Setor and item_id == "setor-1":
                return setor
            if model is Deposito and item_id == "dep-1":
                return deposito
            if model is Gaveta and item_id == "gav-1":
                return gaveta
            return None

        db.get.side_effect = get
        db.scalars.return_value.all.return_value = [
            gaveta
        ]

        with self.assertRaises(HTTPException) as erro:
            _validar_local(
                db,
                setor_id="setor-1",
                deposito_id="dep-1",
                gaveta_id=None,
            )

        self.assertEqual(
            erro.exception.status_code,
            400,
        )
        self.assertIn(
            "gaveta",
            erro.exception.detail.lower(),
        )

        _, _, validada, exige = _validar_local(
            db,
            setor_id="setor-1",
            deposito_id="dep-1",
            gaveta_id="gav-1",
        )

        self.assertTrue(exige)
        self.assertEqual(validada.id, "gav-1")


if __name__ == "__main__":
    unittest.main()
