import { useState, useMemo } from 'react';
import { Plus, FileSpreadsheet, FileDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { parseQtd, formatQtd } from '@/lib/format';
import { formatKg, formatMoeda, nextPedidoNumber } from '@/lib/pesagem';
import { exportPDF, exportCSV } from '@/lib/exports';
import { base44 } from '@/api/base44Client';
import PedidoFormDialog from './PedidoFormDialog';
import PedidoDetalheDialog from './PedidoDetalheDialog';
import DesvincularTicketDialog from './DesvincularTicketDialog';

export default function PedidosManager({ pedidos, pessoas, produtos, tickets, transportadoras, onReload, isAdmin }) {
  const [busca, setBusca] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [editando, setEditando] = useState(null);
  const [desvinc, setDesvinc] = useState(null);
  const { toast } = useToast();

  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const base = [...pedidos].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    if (!q) return base;
    return base.filter((p) =>
      [clienteNome(p.cliente_id), produtoNome(p.produto_id)].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [pedidos, busca]);

  function buildReport() {
    const cols = ['Descrição', 'Número', 'Data', 'Motorista', 'Placa', 'Tara (kg)', 'Bruto (kg)', 'Líquido (kg)', 'Sacas', 'Kg'];
    const rows = [];
    pedidos.forEach((p) => {
      const ps = p.peso_saca_kg || 0;
      const toSacas = (kg) => (ps > 0 ? kg / ps : 0);
      const fmtData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
      // Linha do pedido (valor contratado)
      rows.push([
        `PEDIDO — ${clienteNome(p.cliente_id)} · ${produtoNome(p.produto_id)}`,
        p.numero || '—',
        p.created_date ? fmtData(p.created_date) : '—',
        '', '', '', '', '',
        formatQtd(p.qtd_sacas || 0),
        formatQtd(p.total_kg || 0),
      ]);
      // Tickets vinculados fechados
      const tks = tickets
        .filter((t) => t.pedido_id === p.id && t.status === 'fechado')
        .sort((a, b) => new Date(a.data_fechamento || 0) - new Date(b.data_fechamento || 0));
      tks.forEach((t) => {
        rows.push([
          'Ticket',
          t.numero || '—',
          fmtData(t.data_fechamento),
          t.motorista || '—',
          t.placa || '—',
          formatQtd(t.peso_tara || 0),
          formatQtd(t.peso_bruto || 0),
          formatQtd(t.peso_liquido || 0),
          formatQtd(toSacas(t.peso_liquido || 0)),
          formatQtd(t.peso_liquido || 0),
        ]);
      });
      // Linha de saldo restante
      rows.push([
        'SALDO RESTANTE',
        '', '', '', '', '', '', '',
        formatQtd(toSacas(p.saldo_kg || 0)),
        formatQtd(p.saldo_kg || 0),
      ]);
    });
    return { cols, rows };
  }

  function handleExportPDF() {
    const { cols, rows } = buildReport();
    exportPDF('Relatório de Pedidos de Pesagem', cols, rows);
  }
  function handleExportCSV() {
    const { cols, rows } = buildReport();
    exportCSV('Relatório de Pedidos de Pesagem', cols, rows);
  }

  async function handleDeletePedido(pedido) {
    try {
      const tks = (tickets || []).filter((t) => t.pedido_id === pedido.id);
      if (tks.length > 0) {
        await Promise.all(tks.map((t) => base44.entities.TicketPesagem.update(t.id, { pedido_id: '' })));
      }
      await base44.entities.PedidoPesagem.delete(pedido.id);
      toast({ title: 'Pedido excluído', description: pedido.numero || 'Pedido removido.' });
      setSelecionado(null);
      onReload();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err?.message || '' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button className="shrink-0" onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-2" /> Novo Pedido</Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou produto..." className="pl-9 h-9" />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm">Pedidos ({filtrados.length})</h3>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={pedidos.length === 0}><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
          <Button size="sm" onClick={handleExportCSV} disabled={pedidos.length === 0}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => {
            const pct = p.total_kg > 0 ? Math.max(0, Math.min(100, ((p.saldo_kg || 0) / p.total_kg) * 100)) : 0;
            const pesoSaca = p.peso_saca_kg || 0;
            const restanteSacas = pesoSaca > 0 ? (p.saldo_kg || 0) / pesoSaca : 0;
            const totalSacas = pesoSaca > 0 ? (p.total_kg || 0) / pesoSaca : 0;
            const carregadoPct = p.total_kg > 0 ? Math.max(0, 100 - pct) : 0;
            return (
              <button key={p.id} type="button" onClick={() => setSelecionado(p)} className="w-full text-left">
                <Card className="p-4 hover:shadow-md hover:border-primary/50 transition-all">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.numero && <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{p.numero}</span>}
                        <p className="font-semibold truncate">{clienteNome(p.cliente_id)}</p>
                        <Badge variant={p.status === 'aberto' ? 'default' : 'secondary'} className="capitalize">{p.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{produtoNome(p.produto_id)} · {formatQtd(p.qtd_sacas || 0)} sacas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Restante</p>
                      <p className="text-xl font-bold text-primary leading-tight">{formatQtd(restanteSacas)} <span className="text-xs font-semibold">sacas</span></p>
                      <p className="text-xs text-muted-foreground">Carregado {carregadoPct.toFixed(1)}% · {formatQtd(totalSacas)} sacas</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <PedidoFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={onReload}
        pessoas={pessoas}
        produtos={produtos}
        transportadoras={transportadoras}
        pedidos={pedidos}
      />
      <PedidoFormDialog
        open={!!editando}
        pedido={editando}
        tickets={tickets}
        onClose={() => setEditando(null)}
        onSaved={() => { setEditando(null); onReload(); }}
        pessoas={pessoas}
        produtos={produtos}
        transportadoras={transportadoras}
      />
      <PedidoDetalheDialog
        pedido={selecionado}
        pessoas={pessoas}
        produtos={produtos}
        tickets={tickets}
        onClose={() => setSelecionado(null)}
        isAdmin={isAdmin}
        onEditPedido={(p) => { setSelecionado(null); setEditando(p); }}
        onDesvincularTicket={(t) => { setSelecionado(null); setDesvinc({ ticket: t, pedido: selecionado }); }}
        onDeletePedido={handleDeletePedido}
      />
      <DesvincularTicketDialog
        ticket={desvinc?.ticket}
        pedido={desvinc?.pedido}
        onClose={() => setDesvinc(null)}
        onDone={() => { setDesvinc(null); onReload(); }}
      />
    </div>
  );
}