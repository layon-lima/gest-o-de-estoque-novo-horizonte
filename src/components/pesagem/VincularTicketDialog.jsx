import { useState, useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import SearchSelect from '@/components/SearchSelect';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { formatKg, formatMoeda, formatPlaca, round3, statusPorSaldo } from '@/lib/pesagem';

// Vincula um ticket "não vinculado" a um pedido aberto, subtraindo o peso líquido do saldo.
export default function VincularTicketDialog({ ticket, pedidos, pessoas, onClose, onDone }) {
  const open = !!ticket;
  const [pedidoId, setPedidoId] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';

  const pedidosAbertos = useMemo(
    () => (pedidos || []).filter((p) => p.status === 'aberto' && (Number(p.saldo_kg) || 0) > 0),
    [pedidos]
  );

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
      onDone?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao vincular', description: String(err?.message || err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose?.(); }}>
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
                <SearchSelect
                  value={pedidoId}
                  onChange={setPedidoId}
                  options={pedidosAbertos.map((p) => ({
                    value: p.id,
                    label: `${clienteNome(p.cliente_id)} — saldo ${formatKg(p.saldo_kg)} de ${formatKg(p.total_kg)}`,
                  }))}
                  placeholder="Buscar pedido aberto..."
                />
              </div>

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