import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useLocation,
  useParams,
} from 'react-router-dom';
import {
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useAuth } from '@/lib/AuthContext';
import { useEntidades } from '@/lib/useEntidades';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  readUiState,
  writeUiState,
} from '@/lib/uiStateStore';

import SetorMovimentacaoForm from '@/components/setores/SetorMovimentacaoForm';
import SetorProdutoRow from '@/components/setores/SetorProdutoRow';
import InventarioConference from '@/components/inventario/InventarioConference';
import SetorIcon from '@/components/setorIcon';
import MobileStockActionDialog from '@/components/mobile/MobileStockActionDialog';

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function criarMapa(lista) {
  return new Map(
    (lista || []).map((item) => [item.id, item])
  );
}

function adicionarLocalizacao(
  partes,
  saldo,
  depositosMap,
  gavetasMap,
  lotesMap
) {
  if (!saldo) return;

  const deposito = depositosMap.get(saldo.deposito_id);
  const gaveta = gavetasMap.get(saldo.gaveta_id);
  const lote = lotesMap.get(saldo.lote_id);

  if (deposito) {
    partes.push(
      'deposito',
      deposito.numero,
      deposito.nome,
      `deposito ${deposito.numero || ''}`,
      `deposito ${deposito.nome || ''}`
    );
  }

  if (gaveta) {
    partes.push(
      'gaveta',
      gaveta.codigo,
      gaveta.descricao,
      `gaveta ${gaveta.codigo || ''}`,
      `gaveta ${gaveta.descricao || ''}`
    );
  }

  if (lote) {
    partes.push(
      'lote',
      lote.codigo_lote,
      lote.codigo_referencia,
      `lote ${lote.codigo_lote || ''}`
    );
  }
}

export default function SetorDetail() {
  const { setorId } = useParams();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const [busca, setBusca] = usePersistentState(
    `setor:busca:${setorId}`,
    ''
  );

  const [expandedId, setExpandedId] =
    usePersistentState(
      `setor:exp:${setorId}`,
      null
    );

  const [modalTipo, setModalTipo] = useState(null);
  const [produtoAcoes, setProdutoAcoes] = useState(null);

  const [inventarioOpen, setInventarioOpen] =
    usePersistentState(
      `setor:inv:open:${setorId}`,
      false
    );

  const [inventarioId, setInventarioId] =
    usePersistentState(
      `setor:inv:id:${setorId}`,
      null
    );

  const listRef = useRef(null);

  const { data, loading, reload: load } =
    useEntidades({
      Setor: {},
      Produto: {},
      Maquina: {},
      Gaveta: {},
      Lote: {},
      SaldoEstoque: {},
      Movimentacao: {
        sort: '-data',
        limit: 100,
      },
      Pessoa: {
        sort: '-created_date',
        limit: 500,
      },
      Deposito: {},
    });

  const {
    Setor: setores,
    Produto: produtos,
    Maquina: maquinas,
    Gaveta: gavetas,
    Lote: lotes,
    SaldoEstoque: saldos,
    Movimentacao: movimentacoes,
    Pessoa: pessoas,
    Deposito: depositos,
  } = data;

  useBackHandler(
    !!expandedId,
    () => setExpandedId(null)
  );

  useBackHandler(
    !!modalTipo,
    () => setModalTipo(null)
  );

  useBackHandler(
    !!produtoAcoes,
    () => setProdutoAcoes(null)
  );

  useBackHandler(
    inventarioOpen,
    () => setInventarioOpen(false)
  );

  useEffect(() => {
    const el = listRef.current;

    if (!el) return undefined;

    const saved = readUiState(
      `setor:scroll:${setorId}`
    );

    if (saved) el.scrollTop = saved;

    return () => {
      writeUiState(
        `setor:scroll:${setorId}`,
        el.scrollTop
      );
    };
  }, [setorId, loading]);

  const setor = useMemo(
    () =>
      setores.find(
        (item) => item.id === setorId
      ),
    [setores, setorId]
  );

  const podeVer = useMemo(() => {
    if (!user || !setor) return false;

    if (user.role === 'admin') {
      return true;
    }

    const permitidos = Array.isArray(
      user.setores_permitidos
    )
      ? user.setores_permitidos
      : [];

    return permitidos.includes(setor.id);
  }, [user, setor]);

  const depositosMap = useMemo(
    () => criarMapa(depositos),
    [depositos]
  );

  const gavetasMap = useMemo(
    () => criarMapa(gavetas),
    [gavetas]
  );

  const lotesMap = useMemo(
    () => criarMapa(lotes),
    [lotes]
  );

  const maquinasMap = useMemo(
    () => criarMapa(maquinas),
    [maquinas]
  );

  const saldosPorProduto = useMemo(() => {
    const mapa = new Map();

    (saldos || []).forEach((saldo) => {
      if (!mapa.has(saldo.produto_id)) {
        mapa.set(saldo.produto_id, []);
      }

      mapa.get(saldo.produto_id).push(saldo);
    });

    return mapa;
  }, [saldos]);

  const lotesPorProduto = useMemo(() => {
    const mapa = new Map();

    (lotes || []).forEach((lote) => {
      if (!mapa.has(lote.produto_id)) {
        mapa.set(lote.produto_id, []);
      }

      mapa.get(lote.produto_id).push(lote);
    });

    return mapa;
  }, [lotes]);

  const produtosDoSetor = useMemo(
    () =>
      produtos.filter(
        (produto) =>
          produto.setor_id === setor?.id
      ),
    [produtos, setor]
  );

  const produtosSetor = useMemo(() => {
    const tokens = normalizar(busca)
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) {
      return produtosDoSetor;
    }

    return produtosDoSetor.filter(
      (produto) => {
        const partes = [
          produto.nome,
          produto.codigo,
          produto.codigo_referencia,
          produto.unidade,
        ];

        const maquina = maquinasMap.get(
          produto.maquina_id
        );

        if (maquina) {
          partes.push(
            maquina.nome,
            maquina.codigo
          );
        }

        adicionarLocalizacao(
          partes,
          {
            deposito_id: produto.deposito_id,
            gaveta_id: produto.gaveta_id,
          },
          depositosMap,
          gavetasMap,
          lotesMap
        );

        const saldosProduto =
          saldosPorProduto.get(produto.id) || [];

        saldosProduto.forEach((saldo) =>
          adicionarLocalizacao(
            partes,
            saldo,
            depositosMap,
            gavetasMap,
            lotesMap
          )
        );

        const lotesProduto =
          lotesPorProduto.get(produto.id) || [];

        lotesProduto.forEach((lote) => {
          partes.push(
            'lote',
            lote.codigo_lote,
            lote.codigo_referencia,
            `lote ${lote.codigo_lote || ''}`
          );
        });

        const texto = normalizar(
          partes
            .filter(Boolean)
            .join(' ')
        );

        return tokens.every((token) =>
          texto.includes(token)
        );
      }
    );
  }, [
    busca,
    produtosDoSetor,
    maquinasMap,
    depositosMap,
    gavetasMap,
    lotesMap,
    saldosPorProduto,
    lotesPorProduto,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(
      location.search
    );

    const produtoId = params.get('produto');

    if (
      produtoId &&
      produtosDoSetor.some(
        (produto) => produto.id === produtoId
      )
    ) {
      setExpandedId(produtoId);
    }
  }, [
    location.search,
    produtosDoSetor,
    setExpandedId,
  ]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!setor || !podeVer) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-bold">
          Setor indisponível
        </h1>
        <p className="text-sm text-muted-foreground">
          Você não tem acesso a este setor.
        </p>
      </div>
    );
  }

  const modalMovimentacao = (
    <Dialog
      open={!!modalTipo}
      onOpenChange={(open) =>
        !open && setModalTipo(null)
      }
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {modalTipo === 'entrada'
              ? 'Entrada de estoque'
              : 'Saída de estoque'}
          </DialogTitle>
        </DialogHeader>

        <SetorMovimentacaoForm
          setor={setor}
          produtos={produtos}
          maquinas={maquinas}
          gavetas={gavetas}
          depositos={depositos}
          lotes={lotes}
          saldos={saldos}
          movimentacoes={movimentacoes}
          pessoas={pessoas}
          onSaved={load}
          onClose={() =>
            setModalTipo(null)
          }
          tipoForcado={modalTipo}
        />
      </DialogContent>
    </Dialog>
  );

  const inventario = (
    <InventarioConference
      open={inventarioOpen}
      onOpenChange={(open) => {
        setInventarioOpen(open);

        if (!open) {
          setInventarioId(null);
        }
      }}
      setor={setor}
      produtos={produtos}
      depositos={depositos}
      maquinas={maquinas}
      gavetas={gavetas}
      lotes={lotes}
      user={user}
      onSaved={load}
      initialInventarioId={inventarioId}
      onInventarioAberto={setInventarioId}
    />
  );

  const acoesProdutoDialog = (
    <MobileStockActionDialog
      open={!!produtoAcoes}
      onOpenChange={(open) => {
        if (!open) setProdutoAcoes(null);
      }}
      produto={produtoAcoes}
      user={user}
      saldos={saldos}
      depositos={depositos}
      gavetas={gavetas}
      onSaved={load}
    />
  );

  if (isMobile) {
    return (
      <div className="mobile-page mobile-sector-page">
        <section className="mobile-sector-heading">
          <div
            className="mobile-sector-heading__icon"
            style={{
              color: setor.cor || '#0f8b68',
              backgroundColor: `${
                setor.cor || '#0f8b68'
              }14`,
            }}
          >
            <SetorIcon
              setor={setor}
              className="h-6 w-6"
            />
          </div>

          <div className="mobile-sector-heading__copy">
            <h1>{setor.nome}</h1>
            <span>
              {produtosDoSetor.length}{' '}
              {produtosDoSetor.length === 1
                ? 'produto'
                : 'produtos'}
            </span>
          </div>

          {setor.permite_inventario ? (
            <Button
              variant="outline"
              size="icon"
              className="mobile-sector-inventory-button"
              onClick={() =>
                setInventarioOpen(true)
              }
              aria-label="Abrir inventário"
              title="Inventário"
            >
              <ClipboardList className="h-4 w-4" />
            </Button>
          ) : null}
        </section>

        <section className="mobile-sector-search">
          <Search className="h-5 w-5 shrink-0" />
          <input
            value={busca}
            onChange={(event) =>
              setBusca(event.target.value)
            }
            placeholder="Buscar produto, gaveta, depósito, lote..."
            aria-label={`Pesquisar no setor ${setor.nome}`}
          />
        </section>

        {busca.trim() ? (
          <div className="mobile-sector-result-summary">
            <span>
              {produtosSetor.length}{' '}
              {produtosSetor.length === 1
                ? 'resultado'
                : 'resultados'}
            </span>
            <strong>{busca.trim()}</strong>
          </div>
        ) : null}

        <section
          ref={listRef}
          className="mobile-sector-results"
        >
          {produtosSetor.length === 0 ? (
            <div className="mobile-sector-empty">
              Nenhum produto encontrado.
            </div>
          ) : (
            produtosSetor.map((produto) => (
              <SetorProdutoRow
                key={produto.id}
                produto={produto}
                gavetas={gavetas}
                maquinas={maquinas}
                depositos={depositos}
                lotes={lotes}
                saldos={saldos}
                expanded={
                  expandedId === produto.id
                }
                onToggle={() =>
                  setExpandedId(
                    expandedId === produto.id
                      ? null
                      : produto.id
                  )
                }
                onLongPress={(item) => setProdutoAcoes(item)}
                mobile
              />
            ))
          )}
        </section>

        {acoesProdutoDialog}
        {inventario}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-40 sm:p-6">
      <header className="flex items-center gap-2">
        <div
          className="h-8 w-3 rounded-full"
          style={{
            backgroundColor:
              setor.cor || '#16a34a',
          }}
        />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-tight">
            {setor.nome}
          </h1>

          {setor.controla_validade ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-[10px] text-amber-700"
            >
              Controla validade
            </Badge>
          ) : null}
        </div>

        {setor.permite_inventario ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 md:hidden"
            onClick={() =>
              setInventarioOpen(true)
            }
          >
            <ClipboardList className="h-4 w-4" />
            Inventário
          </Button>
        ) : null}

        {inventarioOpen ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-destructive md:hidden"
            onClick={() =>
              setInventarioOpen(false)
            }
          >
            Fechar
          </Button>
        ) : null}
      </header>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

        <Input
          className="h-12 rounded-xl pl-11 text-base shadow-sm"
          placeholder="Buscar produto por nome ou código…"
          value={busca}
          onChange={(event) =>
            setBusca(event.target.value)
          }
        />
      </div>

      <Card className="p-2 sm:p-3">
        <div
          ref={listRef}
          className="max-h-[55vh] space-y-1 overflow-y-auto scrollbar-thin"
        >
          {produtosSetor.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          ) : (
            produtosSetor.map((produto) => (
              <SetorProdutoRow
                key={produto.id}
                produto={produto}
                gavetas={gavetas}
                maquinas={maquinas}
                depositos={depositos}
                lotes={lotes}
                saldos={saldos}
                expanded={
                  expandedId === produto.id
                }
                onToggle={() =>
                  setExpandedId(
                    expandedId === produto.id
                      ? null
                      : produto.id
                  )
                }
              />
            ))
          )}
        </div>
      </Card>

      <div
        className="fixed inset-x-0 bottom-0 z-20 pb-safe md:hidden"
        style={{
          paddingBottom:
            'calc(env(safe-area-inset-bottom) + 4.25rem)',
        }}
      >
        <div className="mx-auto max-w-3xl px-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-12 rounded-xl text-base"
              onClick={() =>
                setModalTipo('entrada')
              }
            >
              <ArrowDownToLine className="mr-2 h-5 w-5" />
              Entrada
            </Button>

            <Button
              size="lg"
              variant="destructive"
              className="h-12 rounded-xl text-base"
              onClick={() =>
                setModalTipo('saida')
              }
            >
              <ArrowUpFromLine className="mr-2 h-5 w-5" />
              Saída
            </Button>
          </div>
        </div>
      </div>

      {modalMovimentacao}
      {inventario}
    </div>
  );
}
