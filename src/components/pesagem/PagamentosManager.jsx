import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Wallet, FileSpreadsheet, Filter, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { base44 } from '@/api/base44Client';
import { formatQtd } from '@/lib/format';
import { formatMoeda, round3 } from '@/lib/pesagem';
import PagamentoFormDialog from './PagamentoFormDialog';
import PagamentoRelatorioDialog from './PagamentoRelatorioDialog';

const FORMA_LABELS = {
  pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência',
  boleto: 'Boleto', cartao: 'Cartão', cheque: 'Cheque', outro: 'Outro',
};

export default function PagamentosManager({ pagamentos, pedidos, pessoas, tickets, onReload }) {
  const [busca, setBusca] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [pedidosSel, setPedidosSel] = useState([]);
  const [buscaPedido, setBuscaPedido] = useState('');
  const { toast } = useToast();

  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const pedidoNumero = (id) => pedidos.find((p) => p.id === id)?.numero || '—';

  const pedidosDisponiveis = useMemo(() => {
    const q = buscaPedido.toLowerCase().trim();
    return pedidos
      .filter((p) => p.status !== 'cancelado')
      .filter((p) => !q || [p.numero || '', clienteNome(p.cliente_id)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  }, [pedidos, buscaPedido, pessoas]);

  const pedidosBase = useMemo(
    () => (pedidosSel.length > 0 ? pedidos.filter((p) => pedidosSel.includes(p.id)) : pedidos),
    [pedidos, pedidosSel]
  );

  const valorTotalPesado = useMemo(() => {
    return pedidosBase.reduce((acc, ped) => {
      const liquidoKg = (tickets || [])
        .filter((t) => t.pedido_id === ped.id && t.status === 'fechado')
        .reduce((s, t) => s + (Number(t.peso_liquido) || 0), 0);
      const pesoSaca = ped.peso_saca_kg || 0;
      const valorSaca = ped.valor_saca || 0;
      const sacas = pesoSaca > 0 ? liquidoKg / pesoSaca : 0;
      return acc + round3(sacas * valorSaca);
    }, 0);
  }, [pedidosBase, tickets]);

  const valorTotalPago = useMemo(() => {
    const base = pedidosSel.length > 0 ? pagamentos.filter((p) => pedidosSel.includes(p.pedido_id)) : pagamentos;
    return base.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  }, [pagamentos, pedidosSel]);

  const saldoReceber = round3(valorTotalPesado - valorTotalPago);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const base = [...pagamentos].sort((a, b) => new Date(b.data_pagamento || 0) - new Date(a.data_pagamento || 0));
    if (!q) return base;
    return base.filter((p) =>
      [clienteNome(p.cliente_id), pedidoNumero(p.pedido_id), FORMA_LABELS[p.forma_pagamento] || '']
        .join(' ').toLowerCase().includes(q)
    );
  }, [pagamentos, busca, pedidos, pessoas]);

  async function handleExcluir() {
    if (!excluir) return;
    try {
      await base44.entities.Pagamento.delete(excluir.id);
      toast({ title: 'Pagamento excluído' });
      setExcluir(null);
      onReload();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: String(err?.message || err) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              {pedidosSel.length === 0 ? 'Todos os pedidos' : `${pedidosSel.length} pedido(s) selecionado(s)`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={buscaPedido} onChange={(e) => setBuscaPedido(e.target.value)} placeholder="Buscar pedido..." className="pl-8 h-8 text-sm" />
              </div>
            </div>
            <div className="max-h-60 overflow-auto scrollbar-thin p-1">
              <button
                type="button"
                onClick={() => setPedidosSel([])}
                className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${pedidosSel.length === 0 ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
              >
                <span>Todos os pedidos</span>
                {pedidosSel.length === 0 && <CheckCircle2 className="w-4 h-4" />}
              </button>
              {pedidosDisponiveis.map((p) => {
                const checked = pedidosSel.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPedidosSel((prev) => checked ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                    className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left ${checked ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-input'}`}>
                      {checked && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                    </span>
                    <span className="truncate">{p.numero ? `${p.numero} · ` : ''}{clienteNome(p.cliente_id)}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        {pedidosSel.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setPedidosSel([])}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide font-semibold"><Wallet className="w-3.5 h-3.5" /> Total Pesado</div>
          <p className="text-2xl font-bold text-foreground mt-1">{formatMoeda(valorTotalPesado)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide font-semibold"><Wallet className="w-3.5 h-3.5" /> Total Recebido</div>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatMoeda(valorTotalPago)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide font-semibold"><Wallet className="w-3.5 h-3.5" /> Saldo a Receber</div>
          <p className={`text-2xl font-bold mt-1 ${saldoReceber > 0 ? 'text-amber-600' : 'text-primary'}`}>{formatMoeda(saldoReceber)}</p>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button className="shrink-0" onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-2" /> Registrar Pagamento</Button>
        <Button variant="outline" className="shrink-0" onClick={() => setRelatorioOpen(true)}><FileSpreadsheet className="w-4 h-4 mr-2" /> Relatório</Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, pedido ou forma..." className="pl-9 h-9" />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm">Pagamentos ({filtrados.length})</h3>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum pagamento registrado.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => {
            const dt = p.data_pagamento ? new Date(p.data_pagamento).toLocaleString('pt-BR') : '—';
            return (
              <Card key={p.id} className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.numero && <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{p.numero}</span>}
                      <p className="font-semibold truncate">{clienteNome(p.cliente_id)}</p>
                      <Badge variant="secondary" className="text-[10px]">{FORMA_LABELS[p.forma_pagamento] || p.forma_pagamento}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Pedido {pedidoNumero(p.pedido_id)} · {dt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-green-600">{formatMoeda(p.valor)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditando(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setExcluir(p)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PagamentoFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={onReload}
        pedidos={pedidos}
        pessoas={pessoas}
        tickets={tickets}
        pagamentos={pagamentos}
      />
      <PagamentoFormDialog
        open={!!editando}
        pagamento={editando}
        onClose={() => setEditando(null)}
        onSaved={() => { setEditando(null); onReload(); }}
        pedidos={pedidos}
        pessoas={pessoas}
        tickets={tickets}
        pagamentos={pagamentos}
      />
      <AlertDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O pagamento {excluir?.numero} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PagamentoRelatorioDialog
        open={relatorioOpen}
        onClose={() => setRelatorioOpen(false)}
        pagamentos={pagamentos}
        pedidos={pedidos}
        pessoas={pessoas}
        tickets={tickets}
      />
    </div>
  );
}