import { useState, useMemo } from 'react';
import { Link2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { formatKg, formatMoeda, formatPlaca, round3, statusPorSaldo } from '@/lib/pesagem';

// Vincula um ticket "não vinculado" a um pedido aberto, subtraindo o peso líquido do saldo.
export default function VincularTicketDialog({ ticket, pedidos, pessoas, onClose, onDone }) {
  const open = !!ticket;
  const [pedidoId, setPedidoId] = useState('');
  const [busca, setBusca] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';

  const pedidosAbertos = useMemo(
    () => (pedidos || []).filter((p) => p.status === 'aberto' && (Number(p.saldo_kg) || 0) > 0),
    [pedidos]
  );

  const visiveis = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return pedidosAbertos;
    return pedidosAbertos.filter((p) => clienteNome(p.cliente_id).toLowerCase().includes(q));
  }, [pedidosAbertos, busca]);

  const pedidoSelecionado = pedidosAbertos.find((p) => p.id === pedidoId) || null;
  const liq = Number(ticket?.peso_liquido) || 0;
  const saldoInsuficiente = pedidoSelecionado && liq > (Number(pedidoSelecionado.saldo_kg) || 0) + 0.001;

  async function handleVincular() {
    if (!pedidoId) {
      toast({ variant: 'destructive', title: 'Selecione um pedido' });
      return;
    }
    if (saldoInsuficiente) {
      toast({ variant: 'destructive', title: 'Saldo do pedido insuficiente', description: `O ticket pesa ${formatKg(liq)} mas o saldo é ${formatKg(pedidoSelecionado.saldo_kg)}.` });
      return;
    }
    setBusy(true);
    try {
      const novoSaldo = round3((Number(pedidoSelecionado.saldo_kg) || 0) - liq);
      await base44.entities.PedidoPesagem.update(pedidoSelecionado.id, {
        saldo_kg: novoSaldo,
        status: statusPorSaldo(novoSaldo, pedidoSelecionado.total_kg, pedidoSelecionado.status),
      });
      await base44.entities.TicketPesagem.update(ticket.id, { pedido_id: pedidoSelecionado.id });
      toast({ title: 'Ticket vinculado', description: `Saldo do pedido atualizado.` });
      setPedidoId('');
      setBusca('');
      onDone?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao vincular', description: String(err?.message || err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { setPedidoId(''); setBusca(''); onClose?.(); } }}>
      <DialogContent className="max-w-md p-4 sm:p-6">
        {ticket && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Vincular Ticket</DialogTitle>
              <DialogDescription>
                Ticket <b className="font-mono">{ticket.numero}</b> — {ticket.motorista} ({formatPlaca(ticket.placa)}).
                {liq ? ` Peso líquido ${formatKg(liq)} será descontado do saldo do pedido.` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Pedido aberto *</Label>
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar pedido por cliente..."
                  autoFocus
                />
              </div>

              {pedidosAbertos.length === 0 ? (
                <p className="text-sm text-destructive">Nenhum pedido aberto com saldo disponível. Cadastre/abra um pedido antes de vincular.</p>
              ) : (
                <div className="max-h-64 overflow-auto scrollbar-thin space-y-2 rounded-lg border p-2">
                  {visiveis.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground text-center">Nenhum pedido encontrado.</p>
                  ) : visiveis.map((p) => {
                    const selected = p.id === pedidoId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPedidoId(p.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'}`}
                      >
                        <div className="flex justify-between gap-2">
                          <p className="font-medium truncate">{clienteNome(p.cliente_id)}</p>
                          {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">Saldo {formatKg(p.saldo_kg)} de {formatKg(p.total_kg)} · {formatMoeda(p.valor_total)}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {pedidoSelecionado && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-medium truncate">{clienteNome(pedidoSelecionado.cliente_id)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo atual:</span><span className="font-semibold">{formatKg(pedidoSelecionado.saldo_kg)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Após vincular:</span><span className="font-semibold">{formatKg(round3((Number(pedidoSelecionado.saldo_kg) || 0) - liq))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor total:</span><span className="font-semibold">{formatMoeda(pedidoSelecionado.valor_total)}</span></div>
                  {saldoInsuficiente && (
                    <p className="text-xs text-destructive font-medium pt-1">Saldo insuficiente para este ticket.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={onClose}>Cancelar</Button>
                <Button type="button" className="flex-1" disabled={busy || !pedidoId || saldoInsuficiente} onClick={handleVincular}>
                  {busy ? 'Vinculando...' : 'Vincular'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}