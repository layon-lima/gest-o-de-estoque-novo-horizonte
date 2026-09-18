import { useState, useMemo } from 'react';
import { Plus, FileText, Search, Sprout, DollarSign, AlertCircle, AlertTriangle, CalendarDays, ClipboardList, CheckCircle2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import { formatQtd } from '@/lib/format';
import { executarOS, parseItens, diasEmAberto } from '@/lib/osAplicacao';
import OsAplicacaoForm from '@/components/aplicacao/OsAplicacaoForm';
import OsAplicacaoDetalhe from '@/components/aplicacao/OsAplicacaoDetalhe';
import AutobaixaDialog from '@/components/aplicacao/AutobaixaDialog';
import EdicaoMassaDialog from '@/components/aplicacao/EdicaoMassaDialog';
import CustoLavouraDialog from '@/components/aplicacao/CustoLavouraDialog';
import AnoSafraManager from '@/components/aplicacao/AnoSafraManager';
import { gerarPDFResumoOS } from '@/lib/resumoOsPdf';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

export default function Aplicacao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [detalheOs, setDetalheOs] = useState(null);
  const [editandoOs, setEditandoOs] = useState(null);
  const [custoLavoura, setCustoLavoura] = useState(null);
  const [busca, setBusca] = useState('');
  const [tab, setTab] = useState('aberta');
  const [novoConfirm, setNovoConfirm] = useState(false);
  const [anoSafraFiltro, setAnoSafraFiltro] = useState('all');
  const [anosOpen, setAnosOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [autobaixaOpen, setAutobaixaOpen] = useState(false);
  const [autobaixaSaving, setAutobaixaSaving] = useState(false);
  const [edicaoMassaOpen, setEdicaoMassaOpen] = useState(false);
  const [edicaoMassaSaving, setEdicaoMassaSaving] = useState(false);

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
      if (o.status !== tab) return false;
      const matchBusca = !q || [o.numero, o.cultura_nome, o.lavoura_nome, o.ano_safra, o.responsavel].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchAnoSafra = anoSafraFiltro === 'all' || o.ano_safra === anoSafraFiltro;
      return matchBusca && matchAnoSafra;
    });
  }, [ordens, tab, busca, anoSafraFiltro]);

  const abertasFiltered = tab === 'aberta' ? filtered : [];

  // Lavouras com OS executadas para o relatório de custo.
  const lavourasComCusto = useMemo(() => {
    return (lavouras || []).filter((l) => (ordens || []).some((o) => o.lavoura_id === l.id && o.status === 'executada'));
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

  async function handleAutobaixa(distribuicao) {
    setAutobaixaSaving(true);
    const selecionadas = (ordens || []).filter((o) => selectedIds.includes(o.id) && o.status === 'aberta');
    let ok = 0;
    let firstErr = null;
    for (const os of selecionadas) {
      const itens = distribuicao[os.id];
      if (!itens) continue;
      try {
        const osAtualizada = { ...os, itens: JSON.stringify(itens) };
        await base44.entities.OrdemServicoAplicacao.update(os.id, { itens: osAtualizada.itens });
        await executarOS({
          os: osAtualizada,
          produtos,
          lotes,
          saldos,
          movimentacoes,
          responsavel: user?.full_name || user?.email || '',
        });
        ok++;
      } catch (e) {
        firstErr = firstErr || { os, err: e };
        break;
      }
    }
    invalidateEntidade('OrdemServicoAplicacao');
    invalidateEntidade('SaldoEstoque');
    invalidateEntidade('Produto');
    invalidateEntidade('Movimentacao');
    invalidateEntidade('Lote');
    setAutobaixaSaving(false);
    setAutobaixaOpen(false);
    setSelectedIds([]);
    if (firstErr) {
      const msg = String(firstErr.err?.message || firstErr.err);
      let desc = msg;
      if (msg.startsWith('SALDO_INSUFICIENTE')) {
        const [, disp, nome] = msg.split(':');
        desc = `Saldo insuficiente de ${nome || 'produto'} (disponível ${formatQtd(Number(disp) || 0)}) ao executar ${firstErr.os.numero}. ${ok} OS já baixadas.`;
      } else if (msg.startsWith('DEPOSITO_OBRIGATORIO')) {
        desc = `Depósito obrigatório para ${msg.split(':')[1] || 'produto'} em ${firstErr.os.numero}. ${ok} OS já baixadas.`;
      }
      toast({ variant: 'destructive', title: 'Erro na autobaixa', description: desc });
    } else {
      toast({ title: 'Autobaixa concluída', description: `${ok} OS executadas e estoque baixado.` });
    }
  }

  async function handleEdicaoMassa(distribuicao) {
    setEdicaoMassaSaving(true);
    const selecionadas = (ordens || []).filter((o) => selectedIds.includes(o.id) && o.status === 'aberta');
    let ok = 0;
    for (const os of selecionadas) {
      const itens = distribuicao[os.id];
      if (!itens) continue;
      await base44.entities.OrdemServicoAplicacao.update(os.id, { itens: JSON.stringify(itens) });
      ok++;
    }
    invalidateEntidade('OrdemServicoAplicacao');
    setEdicaoMassaSaving(false);
    setEdicaoMassaOpen(false);
    setSelectedIds([]);
    toast({ title: 'Edição em massa concluída', description: `${ok} OS atualizadas.` });
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
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              onClick={() => gerarPDFResumoOS((ordens || []).filter((o) => selectedIds.includes(o.id)))}
            >
              <ClipboardList className="w-4 h-4 mr-2" /> Gerar Resumo PDF ({selectedIds.length})
            </Button>
          )}
          {selectedIds.length >= 2 && (
            <Button onClick={() => setAutobaixaOpen(true)}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Autobaixa ({selectedIds.length})
            </Button>
          )}
          {selectedIds.length >= 2 && (
            <Button variant="outline" onClick={() => setEdicaoMassaOpen(true)}>
              <Edit3 className="w-4 h-4 mr-2" /> Editar em Massa ({selectedIds.length})
            </Button>
          )}
          <Button onClick={() => setNovoConfirm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova OS
          </Button>
        </div>
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
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setAnosOpen(true)}>
          <CalendarDays className="w-4 h-4 mr-1.5" /> Anos Safra
        </Button>
      </div>

      {/* Abas: status da OS + Custos por Lavoura */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto py-1">
          <TabsTrigger value="aberta">Abertas ({(ordens || []).filter((o) => o.status === 'aberta').length})</TabsTrigger>
          <TabsTrigger value="executada">Executadas ({(ordens || []).filter((o) => o.status === 'executada').length})</TabsTrigger>
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
          <p className="text-sm text-muted-foreground mb-4">Nenhuma OS {tab === 'aberta' ? 'aberta' : tab === 'executada' ? 'executada' : 'cancelada'}.</p>
          {tab === 'aberta' && (
            <Button onClick={() => setNovoConfirm(true)} className="mx-auto">
              <Plus className="w-4 h-4 mr-2" /> Criar primeira OS
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="max-h-[55vh] overflow-auto scrollbar-thin">
            <table className="min-w-full w-auto text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 w-10">
                    <Checkbox
                      checked={abertasFiltered.length > 0 && abertasFiltered.every((o) => selectedIds.includes(o.id))}
                      onCheckedChange={(checked) => {
                        const ids = abertasFiltered.map((o) => o.id);
                        setSelectedIds((prev) => checked ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id)));
                      }}
                    />
                  </th>
                  <th className="p-2 text-left whitespace-nowrap">Nº</th>
                  <th className="p-2 text-left whitespace-nowrap">Lavoura</th>
                  <th className="p-2 text-left whitespace-nowrap">Cultura</th>
                  <th className="p-2 text-center whitespace-nowrap">Safra</th>
                  <th className="p-2 text-right whitespace-nowrap">Hectares</th>
                  <th className="p-2 text-center whitespace-nowrap">Produtos</th>
                  <th className="p-2 text-right whitespace-nowrap">Custo</th>
                  <th className="p-2 text-center whitespace-nowrap">Status</th>
                  <th className="p-2 text-center whitespace-nowrap">Dias</th>
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
                      <td className="p-2 w-10" onClick={(e) => e.stopPropagation()}>
                        {o.status === 'aberta' && (
                          <Checkbox
                            checked={selectedIds.includes(o.id)}
                            onCheckedChange={(checked) => setSelectedIds((prev) => checked ? [...prev, o.id] : prev.filter((id) => id !== o.id))}
                          />
                        )}
                      </td>
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
                      <td className="p-2 text-center whitespace-nowrap">
                        {o.status === 'aberta' ? (() => {
                          const d = diasEmAberto(o);
                          const alerta = d > 7;
                          return (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${alerta ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {alerta && <AlertTriangle className="w-3.5 h-3.5" />}{d}d
                            </span>
                          );
                        })() : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{o.data ? new Date(o.data).toLocaleDateString('pt-BR') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Custo por Lavoura (aba) */}
      {tab === 'custos' && (
        lavourasComCusto.length > 0 ? (
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

      <AutobaixaDialog
        open={autobaixaOpen}
        onOpenChange={setAutobaixaOpen}
        ordens={(ordens || []).filter((o) => selectedIds.includes(o.id) && o.status === 'aberta')}
        produtos={produtos}
        saldos={saldos}
        lotes={lotes}
        movimentacoes={movimentacoes}
        onConfirm={handleAutobaixa}
        saving={autobaixaSaving}
      />

      <EdicaoMassaDialog
        open={edicaoMassaOpen}
        onOpenChange={setEdicaoMassaOpen}
        ordens={(ordens || []).filter((o) => selectedIds.includes(o.id) && o.status === 'aberta')}
        produtos={produtos}
        onConfirm={handleEdicaoMassa}
        saving={edicaoMassaSaving}
      />

      <CustoLavouraDialog
        open={!!custoLavoura}
        onOpenChange={(v) => !v && setCustoLavoura(null)}
        lavoura={custoLavoura}
        ordens={ordens}
      />

      <AnoSafraManager
        open={anosOpen}
        onOpenChange={setAnosOpen}
        anosSafra={anosSafra}
      />

      <AlertDialog open={novoConfirm} onOpenChange={setNovoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar nova OS?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja abrir o formulário para criar uma nova Ordem de Serviço de Aplicação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setEditandoOs(null); setFormOpen(true); setNovoConfirm(false); }}>
              Criar OS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}