import { useState, useMemo } from 'react';
import { Plus, FileText, Search, Sprout, DollarSign, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import { formatQtd } from '@/lib/format';
import { executarOS, parseItens, diasEmAberto, normalizarStatusAplicacao } from '@/lib/osAplicacao';
import OsAplicacaoForm from '@/components/aplicacao/OsAplicacaoForm';
import OsAplicacaoDetalhe from '@/components/aplicacao/OsAplicacaoDetalhe';
import CustoLavouraDialog from '@/components/aplicacao/CustoLavouraDialog';
import DataTable from '@/components/tables/DataTable';
import { useColumnConfig } from '@/hooks/useColumnConfig';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const APLICACAO_COLUMN_ORDER = [
  'numero',
  'lavoura',
  'cultura',
  'safra',
  'hectares',
  'produtos',
  'custo',
  'status',
  'dias',
  'data',
];

export default function Aplicacao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [detalheOs, setDetalheOs] = useState(null);
  const [editandoOs, setEditandoOs] = useState(null);
  const [custoLavoura, setCustoLavoura] = useState(null);
  const [busca, setBusca] = useState('');
  const [tab, setTab] = useState('pendente');
  const [novoConfirm, setNovoConfirm] = useState(false);
  const [anoSafraFiltro, setAnoSafraFiltro] = useState('all');

  const { data, loading, reload } = useEntidades({
    Cultura: {},
    Lavoura: {},
    Produto: {},
    SaldoEstoque: {},
    Lote: {},
    Deposito: {},
    Movimentacao: { sort: '-data', limit: 200 },
    OrdemServicoAplicacao: { sort: '-data', limit: 500 },
    Setor: {},
    AnoSafra: {},
  });

  const { Cultura: culturas, Lavoura: lavouras, Produto: produtos, SaldoEstoque: saldos, Lote: lotes, Deposito: depositos, Movimentacao: movimentacoes, OrdemServicoAplicacao: ordens, AnoSafra: anosSafra, Setor: setores } = data;

  const anosSafraOrdenados = useMemo(
    () => [...(anosSafra || [])].sort((a, b) => (b.nome || '').localeCompare(a.nome || '')),
    [anosSafra]
  );

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return (ordens || []).filter((o) => {
      if (normalizarStatusAplicacao(o.status) !== tab) return false;
      const matchBusca = !q || [o.numero, o.cultura_nome, o.lavoura_nome, o.ano_safra, o.responsavel].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchAnoSafra = anoSafraFiltro === 'all' || o.ano_safra === anoSafraFiltro;
      return matchBusca && matchAnoSafra;
    });
  }, [ordens, tab, busca, anoSafraFiltro]);


  // Lavouras com aplicações baixadas para o relatório de custo.
  const lavourasComCusto = useMemo(() => {
    return (lavouras || []).filter((l) => (ordens || []).some((o) => o.lavoura_id === l.id && normalizarStatusAplicacao(o.status) === 'baixada'));
  }, [lavouras, ordens]);

  function handleEditOs(os) {
    setDetalheOs(null);
    setEditandoOs(os);
    setFormOpen(true);
  }

  // Ao salvar (criar/editar) a OS, abre o modal de detalhe imediatamente.
  function handleSavedOs(savedOs) {
    reload();
    setDetalheOs(savedOs);
  }

  async function handleConsumo(os, itensAtualizados) {
    // Atualiza os itens da OS com o realizado antes de executar.
    const osAtualizada = { ...os, itens: JSON.stringify(itensAtualizados) };
    await api.entities.OrdemServicoAplicacao.update(os.id, { itens: osAtualizada.itens });

    await executarOS({
      os: osAtualizada,
      produtos,
      lotes,
      saldos,
      movimentacoes,
      responsavel: user?.full_name || user?.email || '',
    });

    invalidateEntidade('OrdemServicoAplicacao');
    invalidateEntidade('SaldoEstoque');
    invalidateEntidade('Produto');
    invalidateEntidade('Movimentacao');
    invalidateEntidade('Lote');
    toast({ title: 'Consumo lançado', description: `${os.numero} executada. Estoque baixado.` });
  }

  const aplicacaoColumns = [
    {
      key: 'numero',
      label: 'Nº',
      minWidth: 80,
      render: (o) => (
        <span className="font-mono text-xs font-medium">{o.numero}</span>
      ),
    },
    {
      key: 'lavoura',
      label: 'Lavoura',
      minWidth: 120,
      render: (o) => (
        <span className="font-medium">{o.lavoura_nome || '—'}</span>
      ),
    },
    {
      key: 'cultura',
      label: 'Cultura',
      minWidth: 100,
      render: (o) => o.cultura_nome || '—',
    },
    {
      key: 'safra',
      label: 'Safra',
      minWidth: 82,
      render: (o) => o.ano_safra || '—',
    },
    {
      key: 'hectares',
      label: 'Hectares',
      minWidth: 92,
      render: (o) => (
        <span className="tabular-nums">{formatQtd(o.hectares || 0)} ha</span>
      ),
    },
    {
      key: 'produtos',
      label: 'Produtos',
      minWidth: 86,
      render: (o) => (
        <span className="tabular-nums">{parseItens(o.itens).length}</span>
      ),
    },
    {
      key: 'custo',
      label: 'Custo',
      minWidth: 100,
      render: (o) => (
        <span className="tabular-nums">
          {o.custo_total
            ? `R$ ${Number(o.custo_total).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      minWidth: 96,
      render: (o) => {
        const status = normalizarStatusAplicacao(o.status);
        const className =
          status === 'pendente'
            ? 'bg-blue-500 text-white border-transparent'
            : status === 'baixada'
              ? 'bg-emerald-600 text-white border-transparent'
              : 'bg-muted text-muted-foreground border-transparent';
        const label =
          status === 'pendente'
            ? 'Pendente'
            : status === 'baixada'
              ? 'Baixada'
              : 'Cancelada';

        return <Badge className={className}>{label}</Badge>;
      },
    },
    {
      key: 'dias',
      label: 'Dias',
      minWidth: 76,
      render: (o) => {
        if (normalizarStatusAplicacao(o.status) !== 'pendente') {
          return <span className="text-muted-foreground">—</span>;
        }

        const dias = diasEmAberto(o);
        const alerta = dias > 7;

        return (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              alerta ? 'text-red-600' : 'text-muted-foreground'
            }`}
          >
            {alerta && <AlertTriangle className="h-3.5 w-3.5" />}
            {dias}d
          </span>
        );
      },
    },
    {
      key: 'data',
      label: 'Data',
      minWidth: 96,
      render: (o) => (
        <span className="text-xs text-muted-foreground">
          {o.data ? new Date(o.data).toLocaleDateString('pt-BR') : '—'}
        </span>
      ),
    },
  ];

  const aplicacaoConfig = useColumnConfig(
    'aplicacaoTableColsV1',
    APLICACAO_COLUMN_ORDER
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3 p-3 lg:px-4 xl:px-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold">Aplicações</h1>
          <p className="text-sm text-muted-foreground mt-1">Planejamento, baixa de insumos e rastreabilidade por lavoura</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setNovoConfirm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova aplicação
          </Button>
        </div>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-4 h-4" /> Total OS</div>
          <p className="text-lg font-semibold tabular-nums">{ordens?.length || 0}</p>
        </Card>
        <Card className="rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertCircle className="w-4 h-4" /> Abertas</div>
          <p className="text-lg font-semibold tabular-nums text-blue-600">{(ordens || []).filter((o) => normalizarStatusAplicacao(o.status) === 'pendente').length}</p>
        </Card>
        <Card className="rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Sprout className="w-4 h-4" /> Lavouras</div>
          <p className="text-lg font-semibold tabular-nums">{lavouras?.length || 0}</p>
        </Card>
        <Card className="rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" /> Custo Total</div>
          <p className="text-lg font-semibold tabular-nums text-primary">
            R$ {(ordens || []).reduce((s, o) => s + (Number(o.custo_total) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* Pastas por Ano Safra */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground shrink-0">Ano Safra:</span>
        <button
          type="button"
          onClick={() => setAnoSafraFiltro('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${anoSafraFiltro === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
        >
          Todos
        </button>
        {anosSafraOrdenados.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAnoSafraFiltro(a.nome)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${anoSafraFiltro === a.nome ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {/* Abas: status da OS + Custos por Lavoura */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto py-1">
          <TabsTrigger value="pendente">Pendentes ({(ordens || []).filter((o) => normalizarStatusAplicacao(o.status) === 'pendente').length})</TabsTrigger>
          <TabsTrigger value="baixada">Baixadas ({(ordens || []).filter((o) => normalizarStatusAplicacao(o.status) === 'baixada').length})</TabsTrigger>
          <TabsTrigger value="cancelada">Canceladas ({(ordens || []).filter((o) => o.status === 'cancelada').length})</TabsTrigger>
          <TabsTrigger value="custos">Custos por Lavoura</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab !== 'custos' && (
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número, lavoura, cultura..." className="pl-9" />
          </div>
        </div>
      )}

      {tab !== 'custos' && (
      filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma OS {tab === 'pendente' ? 'aberta' : tab === 'baixada' ? 'executada' : 'cancelada'}.</p>
          {tab === 'pendente' && (
            <Button onClick={() => setNovoConfirm(true)} className="mx-auto">
              <Plus className="w-4 h-4 mr-2" /> Criar primeira aplicação
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden rounded-2xl border shadow-none">
          <DataTable
            config={aplicacaoConfig}
            columns={aplicacaoColumns}
            data={filtered}
            getRowId={(o) => o.id}
            onRowClick={(o) => setDetalheOs(o)}
            rowClassName="cursor-pointer"
            containerClassName="max-h-[55vh]"
            showToolbar={false}
          />
        </Card>
      ))}

      {/* Custo por Lavoura (aba) */}
      {tab === 'custos' && (
        lavourasComCusto.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lavourasComCusto.map((l) => {
              const custo = (ordens || [])
                .filter((o) => o.lavoura_id === l.id && normalizarStatusAplicacao(o.status) === 'baixada')
                .reduce((s, o) => s + (Number(o.custo_total) || 0), 0);
              return (
                <Card key={l.id} className="p-4 cursor-pointer hover:bg-accent/30" onClick={() => setCustoLavoura(l)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{l.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatQtd(l.hectares || 0)} ha</p>
                    </div>
                    <DollarSign className="w-4 h-4 text-primary shrink-0" />
                  </div>
                  <p className="text-xl font-bold text-primary mt-2 tabular-nums">
                    R$ {custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">Nenhuma OS executada para o relatório de custos.</p>
          </Card>
        )
      )}

      <OsAplicacaoForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditandoOs(null); }}
        onSaved={handleSavedOs}
        culturas={culturas}
        lavouras={lavouras}
        produtos={produtos}
        saldos={saldos}
        depositos={depositos}
        ordens={ordens}
        os={editandoOs}
        anosSafra={anosSafra}
        setores={setores}
      />

      <OsAplicacaoDetalhe
        open={!!detalheOs}
        onOpenChange={(v) => !v && setDetalheOs(null)}
        os={detalheOs}
        culturas={culturas}
        lavouras={lavouras}
        produtos={produtos}
        saldos={saldos}
        lotes={lotes}
        movimentacoes={movimentacoes}
        onConsumo={handleConsumo}
        onEdit={handleEditOs}
      />

      <CustoLavouraDialog
        open={!!custoLavoura}
        onOpenChange={(v) => !v && setCustoLavoura(null)}
        lavoura={custoLavoura}
        ordens={ordens}
      />


      <AlertDialog open={novoConfirm} onOpenChange={setNovoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar nova aplicação?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja abrir o formulário para criar uma nova aplicação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setEditandoOs(null); setFormOpen(true); setNovoConfirm(false); }}>
              Criar aplicação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
