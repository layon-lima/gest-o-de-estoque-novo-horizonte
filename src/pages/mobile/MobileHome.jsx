import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Fuel,
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useEntidades } from '@/lib/useEntidades';
import { filterProdutos } from '@/lib/estoqueFilters';
import { mobilePageAllowed } from '@/lib/mobileAccess';
import { setoresAcessiveis } from '@/lib/setoresAcesso';

const FILTROS_VAZIOS = {
  setor_id: [],
  estoque: '',
  deposito_id: [],
  maquina_id: [],
  gaveta_id: [],
  unidade: [],
  codigo: '',
  referencia: '',
  quantidade_min: '',
  quantidade_max: '',
  valor_unit_min: '',
  valor_unit_max: '',
  valor_total_min: '',
  valor_total_max: '',
};

export default function MobileHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const podeAbastecer = mobilePageAllowed(
    user,
    'abastecimento'
  );

  const { data, loading } = useEntidades({
    Produto: {},
    Setor: {},
    SaldoEstoque: {},
  });

  const produtos = data.Produto || [];
  const setores = data.Setor || [];
  const saldos = data.SaldoEstoque || [];

  const produtosComSaldo = useMemo(
    () =>
      filterProdutos(
        produtos,
        FILTROS_VAZIOS,
        saldos
      ),
    [produtos, saldos]
  );

  const setoresVisiveis = useMemo(
    () => setoresAcessiveis(setores, user),
    [setores, user]
  );

  const setorIds = useMemo(
    () =>
      new Set(
        setoresVisiveis.map((setor) => setor.id)
      ),
    [setoresVisiveis]
  );

  const produtosVisiveis = useMemo(
    () =>
      produtosComSaldo.filter((produto) =>
        setorIds.has(produto.setor_id)
      ),
    [produtosComSaldo, setorIds]
  );

  return (
    <div className="mobile-page mobile-home mobile-home-v5">
      {podeAbastecer ? (
        <button
          type="button"
          className="mobile-fuel-shortcut"
          onClick={() =>
            navigate('/abastecimento')
          }
        >
          <span className="mobile-fuel-shortcut__icon">
            <Fuel className="h-7 w-7" />
          </span>

          <span className="mobile-fuel-shortcut__copy">
            <strong>ABASTECEDOR</strong>
            <small>
              Registrar abastecimento
            </small>
          </span>

          <span className="mobile-fuel-shortcut__arrow">
            <ArrowRight className="h-5 w-5" />
          </span>
        </button>
      ) : null}

      <section className="mobile-home-sectors">
        <div className="mobile-section-heading mobile-section-heading--simple">
          <div>
            <span className="mobile-eyebrow">
              Seus setores
            </span>

            <p className="mobile-section-copy">
              Acesse os setores liberados para você.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mobile-loading-card">
            Carregando setores...
          </div>
        ) : setoresVisiveis.length === 0 ? (
          <div className="mobile-loading-card">
            Nenhum setor foi liberado para este usuário.
          </div>
        ) : (
          <div className="mobile-sector-grid">
            {setoresVisiveis.map((setor) => {
              const itens =
                produtosVisiveis.filter(
                  (produto) =>
                    produto.setor_id === setor.id
                );

              return (
                <button
                  type="button"
                  key={setor.id}
                  className="mobile-sector-card mobile-sector-card--v5"
                  onClick={() =>
                    navigate(`/setor/${setor.id}`)
                  }
                  style={{
                    '--sector-color':
                      setor.cor || '#0f8b68',
                    '--sector-soft': `${
                      setor.cor || '#0f8b68'
                    }10`,
                  }}
                >
                  <span className="mobile-sector-card__content">
                    <strong title={setor.nome}>
                      {setor.nome}
                    </strong>

                    <small>
                      {itens.length}{' '}
                      {itens.length === 1
                        ? 'produto'
                        : 'produtos'}
                    </small>
                  </span>

                  <span className="mobile-sector-card__arrow">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
