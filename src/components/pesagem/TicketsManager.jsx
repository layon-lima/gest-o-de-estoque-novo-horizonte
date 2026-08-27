import { useState, useMemo } from 'react';
import { Plus, FileSpreadsheet, FileDown, Search, CircleDot, CheckCircle2, Link2, Unlink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { parseQtd, formatQtd } from '@/lib/format';
import { formatPlaca, formatKg, round3, statusPorSaldo } from '@/lib/pesagem';
import { exportPDF, exportCSV } from '@/lib/exports';
import AberturaTicketDialog from './AberturaTicketDialog';
import FechamentoTicketDialog from './FechamentoTicketDialog';
import TicketDetalheDialog from './TicketDetalheDialog';
import VincularTicketDialog from './VincularTicketDialog';

export default function TicketsManager({ tickets, pedidos, pessoas, produtos, transportadoras, onReload, mode = 'ativos', isAdmin }) {
  const historico = mode === 'historico';
  const naovinculados = mode === 'naovinculados';
  const [busca, setBusca] = useState('');
  const [fecharTicket, setFecharTicket] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [detalheTicket, setDetalheTicket] = useState(null);
  const [vincularTicket, setVincularTicket] = useState(null);
  const [excluirTicket, setExcluirTicket] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const { toast } = useToast();

  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';
  const pedidoDoTicket = (id) => pedidos.find((p) => p.id === id);

  const abertos = useMemo(
    () => tickets.filter((t) => t.status === 'aberto').sort((a, b) => new Date(b.data_abertura) - new Date(a.data_abertura)),
    [tickets]
  );

  const naoVinculados = useMemo(
    () => tickets.filter((t) => t.status === 'fechado' && t.tipo === 'venda' && !t.pedido_id).sort((a, b) => new Date(b.data_abertura) - new Date(a.data_abertura)),
    [tickets]
  );

  const filtrados = useMemo(() => {
    if (naovinculados) {
      const q = busca.toLowerCase().trim();
      if (!q) return naoVinculados;
      return naoVinculados.filter((t) => [t.numero, t.motorista, t.placa].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    const q = busca.toLowerCase().trim();
    const base = tickets.filter((t) => t.status !== 'aberto');
    const match = (t) => {
      if (!q) return true;
      const ped = pedidoDoTicket(t.pedido_id);
      return [t.numero, t.motorista, t.placa, ped ? clienteNome(ped.cliente_id) : ''].filter(Boolean).join(' ').toLowerCase().includes(q);
    };
    if (!historico && !q) return [];
    return base.filter(match).sort((a, b) => {
      // Mais recentes no topo, mais antigos para baixo
      return new Date(b.data_fechamento || b.data_abertura) - new Date(a.data_fechamento || a.data_abertura);
    });
  }, [tickets, busca, historico, naovinculados, naoVinculados]);

  async function handleExcluir() {
    if (!excluirTicket) return;
    setExcluindo(true);
    try {
      // Devolve o peso líquido ao saldo do pedido vinculado, sempre que houver vínculo.
      const ped = excluirTicket.pedido_id ? pedidoDoTicket(excluirTicket.pedido_id) : null;
      if (ped) {
        const liq = Number(excluirTicket.peso_liquido) || 0;
        const novoSaldo = round3((Number(ped.saldo_kg) || 0) + liq);
        await base44.entities.PedidoPesagem.update(ped.id, {
          saldo_kg: novoSaldo,
          status: statusPorSaldo(novoSaldo, ped.total_kg, ped.status),
        });
      }
      await base44.entities.TicketPesagem.delete(excluirTicket.id);
      toast({ title: 'Ticket excluído', description: ped ? 'Saldo do pedido restaurado.' : excluirTicket.numero });
      setExcluirTicket(null);
      onReload();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: String(err?.message || err) });
    } finally {
      setExcluindo(false);
    }
  }

  function buildRows() {
    return filtrados.map((t) => {
      const ped = pedidoDoTicket(t.pedido_id);
      return [
        t.numero,
        t.data_abertura ? new Date(t.data_abertura).toLocaleString('pt-BR') : '',
        t.data_fechamento ? new Date(t.data_fechamento).toLocaleString('pt-BR') : '',
        t.motorista || '',
        formatPlaca(t.placa),
        formatQtd(t.peso_tara || 0),
        formatQtd(t.peso_bruto || 0),
        formatQtd(t.peso_liquido || 0),
        ped ? clienteNome(ped.cliente_id) : '',
        ped ? produtoNome(ped.produto_id) : '',
        t.status,
      ];
    });
  }
  const expCols = ['Ticket', 'Abertura', 'Fechamento', 'Motorista', 'Placa', 'Tara (kg)', 'Bruto (kg)', 'Líquido (kg)', 'Cliente', 'Produto', 'Status'];
  function handleExportPDF() { exportPDF('Relatório de Tickets de Pesagem', expCols, buildRows()); }
  function handleExportCSV() { exportCSV('Relatório de Tickets de Pesagem', expCols, buildRows()); }

  const semBusca = !busca.trim();

  return (
    <div className="space-y-4">
      {/* Botão de abertura */}
      {!historico && !naovinculados && (
        <Button onClick={() => setFormAberto(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" /> Abrir Novo Ticket
        </Button>
      )}

      {/* Tickets abertos em destaque */}
      {!historico && !naovinculados && abertos.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><CircleDot className="w-4 h-4 text-amber-500" /> Abertos ({abertos.length})</h3>
          <div className="space-y-2 max-h-[40vh] overflow-auto scrollbar-thin pr-1">
            {abertos.map((t) => (
              <Card key={t.id} className="p-3 border-amber-300 bg-amber-50/60">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetalheTicket(t)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-xs">{t.numero}</span>
                      <span className="font-medium text-sm truncate">{t.motorista}</span>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white border">{formatPlaca(t.placa)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">Tara: <span className="font-semibold text-foreground">{formatKg(t.peso_tara)}</span></span>
                      <span className="text-[10px] text-muted-foreground">{t.data_abertura ? new Date(t.data_abertura).toLocaleString('pt-BR') : ''}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" onClick={() => setFecharTicket(t)}>Fechar</Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setExcluirTicket(t)} title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Busca / Histórico */}
      <div className="space-y-2">
        {naovinculados && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Unlink className="w-4 h-4" />
            <span>Tickets de venda fechados sem pedido vinculado ({naoVinculados.length}).</span>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={naovinculados ? 'Buscar ticket, motorista ou placa...' : 'Buscar ticket, motorista, placa ou cliente...'} className="pl-9 h-9" />
        </div>

        {historico && (
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8" onClick={handleExportPDF} disabled={filtrados.length === 0}><FileDown className="w-3.5 h-3.5 mr-1.5" /> PDF</Button>
            <Button size="sm" className="flex-1 h-8" onClick={handleExportCSV} disabled={filtrados.length === 0}><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel</Button>
          </div>
        )}

        {/* Mobile: cards */}
        <div className="sm:hidden max-h-[44vh] overflow-auto scrollbar-thin space-y-2 pr-1">
          {filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {naovinculados ? 'Nenhuma venda fechada sem pedido.' : historico ? 'Nenhum ticket fechado.' : semBusca ? 'Use a busca para encontrar tickets fechados.' : 'Nenhum ticket encontrado.'}
            </p>
          ) : filtrados.map((t) => {
            const ped = pedidoDoTicket(t.pedido_id);
            return (
              <Card key={t.id} className="p-3 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setDetalheTicket(t)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-xs">{t.numero}</span>
                  <div className="flex items-center gap-1.5">
                    {naovinculados && isAdmin && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setVincularTicket(t); }}>
                        <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular
                      </Button>
                    )}
                    <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" /> Fechado</Badge>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className="font-medium truncate">{t.motorista}</span>
                  <span className="text-xs font-mono text-muted-foreground">{formatPlaca(t.placa)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Tara <b className="text-foreground">{formatKg(t.peso_tara)}</b></span>
                  {t.peso_liquido ? <span>Líq. <b className="text-foreground">{formatKg(t.peso_liquido)}</b></span> : null}
                  <span className="truncate">{ped ? clienteNome(ped.cliente_id) : ''}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Desktop: tabela */}
        {filtrados.length === 0 ? (
          <p className="hidden sm:block text-sm text-muted-foreground text-center py-6">
            {naovinculados ? 'Nenhuma venda fechada sem pedido.' : historico ? 'Nenhum ticket fechado.' : semBusca ? 'Use a busca para encontrar tickets fechados.' : 'Nenhum ticket encontrado.'}
          </p>
        ) : (
          <div className="hidden sm:block rounded-lg border overflow-auto scrollbar-thin max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Ticket</th>
                  <th className="text-left p-2 font-medium">Abertura</th>
                  <th className="text-left p-2 font-medium">Fechamento</th>
                  <th className="text-left p-2 font-medium">Motorista</th>
                  <th className="text-left p-2 font-medium">Placa</th>
                  <th className="text-right p-2 font-medium">Tara</th>
                  <th className="text-right p-2 font-medium">Bruto</th>
                  <th className="text-right p-2 font-medium">Líquido</th>
                  <th className="text-left p-2 font-medium">Cliente</th>
                  <th className="text-center p-2 font-medium">Status</th>
                  {naovinculados && isAdmin && <th className="text-center p-2 font-medium">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => {
                  const ped = pedidoDoTicket(t.pedido_id);
                  return (
                    <tr key={t.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => setDetalheTicket(t)}>
                      <td className="p-2 font-mono text-xs">{t.numero}</td>
                      <td className="p-2 text-xs whitespace-nowrap">{t.data_abertura ? new Date(t.data_abertura).toLocaleString('pt-BR') : '—'}</td>
                      <td className="p-2 text-xs whitespace-nowrap">{t.data_fechamento ? new Date(t.data_fechamento).toLocaleString('pt-BR') : '—'}</td>
                      <td className="p-2">{t.motorista}</td>
                      <td className="p-2 font-mono">{formatPlaca(t.placa)}</td>
                      <td className="p-2 text-right">{formatQtd(t.peso_tara || 0)}</td>
                      <td className="p-2 text-right">{t.peso_bruto ? formatQtd(t.peso_bruto) : '—'}</td>
                      <td className="p-2 text-right font-semibold">{t.peso_liquido ? formatQtd(t.peso_liquido) : '—'}</td>
                      <td className="p-2 text-xs">{ped ? clienteNome(ped.cliente_id) : '—'}</td>
                      <td className="p-2 text-center">
                        <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Fechado</Badge>
                      </td>
                      {naovinculados && isAdmin && (
                        <td className="p-2 text-center">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setVincularTicket(t); }}>
                            <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!historico && (
        <FechamentoTicketDialog
          ticket={fecharTicket}
          pedidos={pedidos}
          pessoas={pessoas}
          produtos={produtos}
          transportadoras={transportadoras}
          open={!!fecharTicket}
          onClose={() => setFecharTicket(null)}
          onClosed={() => { setFecharTicket(null); onReload(); }}
          onReload={onReload}
        />
      )}

      <TicketDetalheDialog
        ticket={detalheTicket}
        pedidos={pedidos}
        pessoas={pessoas}
        produtos={produtos}
        onClose={() => setDetalheTicket(null)}
        onExcluir={(t) => { setDetalheTicket(null); setExcluirTicket(t); }}
      />

      <AlertDialog open={!!excluirTicket} onOpenChange={(o) => !o && setExcluirTicket(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluirTicket && (
                <>Tem certeza que deseja excluir o ticket <b className="font-mono">{excluirTicket.numero}</b> ({excluirTicket.motorista} / {formatPlaca(excluirTicket.placa)})? Esta ação não pode ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} disabled={excluindo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {naovinculados && (
        <VincularTicketDialog
          ticket={vincularTicket}
          pedidos={pedidos}
          pessoas={pessoas}
          onClose={() => setVincularTicket(null)}
          onDone={() => { setVincularTicket(null); onReload(); }}
        />
      )}

      {!historico && !naovinculados && (
        <AberturaTicketDialog
          open={formAberto}
          onClose={() => setFormAberto(false)}
          onReload={onReload}
          tickets={tickets}
          pessoas={pessoas}
          produtos={produtos}
          transportadoras={transportadoras}
        />
      )}
    </div>
  );
}