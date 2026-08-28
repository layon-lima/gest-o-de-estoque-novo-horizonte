import { useState, useMemo } from 'react';
import { Plus, FileText, Search, Sprout, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import { formatQtd } from '@/lib/format';
import { executarOS, parseItens } from '@/lib/osAplicacao';
import OsAplicacaoForm from '@/components/aplicacao/OsAplicacaoForm';
import OsAplicacaoDetalhe from '@/components/aplicacao/OsAplicacaoDetalhe';
import CustoLavouraDialog from '@/components/aplicacao/CustoLavouraDialog';

const STATUS_FILTERS = [
  { v: 'all', l: 'Todas' },
  { v: 'aberta', l: 'Abertas' },
  { v: 'executada', l: 'Executadas' },
  { v: 'cancelada', l: 'Canceladas' },
];

export default function Aplicacao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [detalheOs, setDetalheOs] = useState(null);
  const [custoLavoura, setCustoLavoura] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');

  const { data, loading, reload } = useEntidades({
    Cultura: {},
    Lavoura: {},
    Produto: {},
    SaldoEstoque: {},
    Lote: {},
    Deposito: {},
    Movimentacao: { sort: '-data', limit: 200 },
    OrdemServicoAplicacao: { sort: '-data', limit: 500 },
  });

  const { Cultura: culturas, Lavoura: lavouras, Produto: produtos, SaldoEstoque: saldos, Lote: lotes, Deposito: depositos, Movimentacao: movimentacoes, OrdemServicoAplicacao: ordens } = data;

  const filtered = useMemo(() => {
    return (ordens || []).filter((o) => {
      const matchStatus = filtroStatus === 'all' || o.status === filtroStatus;
      const q = busca.toLowerCase().trim();
      const matchBusca = !q || [o.numero, o.cultura_nome, o.lavoura_nome, o.ano_safra, o.responsavel].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchStatus && matchBusca;
    });
  }, [ordens, filtroStatus, busca]);

  // Lavouras com OS executadas para o relatório de custo.
  const lavourasComCusto = useMemo(() => {
    return (lavouras || []).filter((l) => (ordens || []).some((o) => o.lavoura_id === l.id && o.status === 'executada'));
  }, [lavouras, ordens]);

  async function handleConsumo(os, itensAtualizados) {
    // Atualiza os itens da OS com o realizado antes de executar.
    const osAtualizada = { ...os, itens: JSON.stringify(itensAtualizados) };
    await base44.entities.OrdemServicoAplicacao.update(os.id, { itens: osAtualizada.itens });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Aplicação por Lavoura</h1>
          <p className="text-sm text-muted-foreground mt-1">Ordens de serviço de aplicação de adubos e defensivos</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova OS
        </Button>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-4 h-4" /> Total OS</div>
          <p className="text-2xl font-bold tabular-nums">{ordens?.length || 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertCircle className="w-4 h-4" /> Abertas</div>
          <p className="text-2xl font-bold tabular-nums text-blue-600">{(ordens || []).filter((o) => o.status === 'aberta').length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Sprout className="w-4 h-4" /> Lavouras</div>
          <p className="text-2xl font-bold tabular-nums">{lavouras?.length || 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" /> Custo Total</div>
          <p className="text-2xl font-bold tabular-nums text-primary">
            R$ {(ordens || []).reduce((s, o) => s + (Number(o.custo_total) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número, lavoura, cultura..." className="pl-9" />
        </div>
        <div className="flex rounded-lg border overflow-hidden shrink-0">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setFiltroStatus(opt.v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filtroStatus === opt.v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de OS */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma OS encontrada.</p>
          <Button onClick={() => setFormOpen(true)} className="mx-auto">
            <Plus className="w-4 h-4 mr-2" /> Criar primeira OS
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="max-h-[55vh] overflow-auto scrollbar-thin">
            <table className="min-w-full w-auto text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left whitespace-nowrap">Nº</th>
                  <th className="p-2 text-left whitespace-nowrap">Lavoura</th>
                  <th className="p-2 text-left whitespace-nowrap">Cultura</th>
                  <th className="p-2 text-center whitespace-nowrap">Safra</th>
                  <th className="p-2 text-right whitespace-nowrap">Hectares</th>
                  <th className="p-2 text-center whitespace-nowrap">Produtos</th>
                  <th className="p-2 text-right whitespace-nowrap">Custo</th>
                  <th className="p-2 text-center whitespace-nowrap">Status</th>
                  <th className="p-2 text-left whitespace-nowrap">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const qtdItens = parseItens(o.itens).length;
                  const statusBadge = o.status === 'aberta'
                    ? 'bg-blue-500 text-white border-transparent'
                    : o.status === 'executada'
                      ? 'bg-emerald-600 text-white border-transparent'
                      : 'bg-muted text-muted-foreground border-transparent';
                  const statusLabel = o.status === 'aberta' ? 'Aberta' : o.status === 'executada' ? 'Executada' : 'Cancelada';
                  return (
                    <tr key={o.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setDetalheOs(o)}>
                      <td className="p-2 whitespace-nowrap font-mono text-xs font-medium">{o.numero}</td>
                      <td className="p-2 whitespace-nowrap font-medium">{o.lavoura_nome || '—'}</td>
                      <td className="p-2 whitespace-nowrap">{o.cultura_nome || '—'}</td>
                      <td className="p-2 text-center whitespace-nowrap">{o.ano_safra || '—'}</td>
                      <td className="p-2 text-right whitespace-nowrap tabular-nums">{formatQtd(o.hectares || 0)} ha</td>
                      <td className="p-2 text-center whitespace-nowrap tabular-nums">{qtdItens}</td>
                      <td className="p-2 text-right whitespace-nowrap tabular-nums">
                        {o.custo_total ? `R$ ${Number(o.custo_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap"><Badge className={statusBadge}>{statusLabel}</Badge></td>
                      <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{o.data ? new Date(o.data).toLocaleDateString('pt-BR') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Relatório de custo por lavoura */}
      {lavourasComCusto.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Custo por Lavoura</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lavourasComCusto.map((l) => {
              const custo = (ordens || [])
                .filter((o) => o.lavoura_id === l.id && o.status === 'executada')
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
        </div>
      )}

      <OsAplicacaoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={reload}
        culturas={culturas}
        lavouras={lavouras}
        produtos={produtos}
        saldos={saldos}
        depositos={depositos}
        ordens={ordens}
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
      />

      <CustoLavouraDialog
        open={!!custoLavoura}
        onOpenChange={(v) => !v && setCustoLavoura(null)}
        lavoura={custoLavoura}
        ordens={ordens}
      />
    </div>
  );
}