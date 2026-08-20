import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatKg, formatMoeda, formatPlaca } from '@/lib/pesagem';
import { formatQtd } from '@/lib/format';

export default function TicketDetalheDialog({ ticket, pedidos, pessoas, produtos, onClose }) {
  const open = !!ticket;
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';
  const pedido = ticket ? pedidos.find((p) => p.id === ticket.pedido_id) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        {ticket && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">Ticket {ticket.numero}</DialogTitle>
              <DialogDescription>Detalhes da pesagem.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={ticket.status === 'aberto' ? 'default' : 'secondary'} className="capitalize">{ticket.status}</Badge>
                <span className="text-xs text-muted-foreground">Abertura: {ticket.data_abertura ? new Date(ticket.data_abertura).toLocaleString('pt-BR') : '—'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Motorista</p>
                  <p className="font-medium truncate">{ticket.motorista || '—'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Placa</p>
                  <p className="font-medium font-mono">{formatPlaca(ticket.placa)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tara</p>
                  <p className="font-semibold">{formatKg(ticket.peso_tara)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Peso bruto</p>
                  <p className="font-semibold">{ticket.peso_bruto ? formatKg(ticket.peso_bruto) : '—'}</p>
                </div>
                <div className="rounded-lg border p-3 bg-primary/5 col-span-2">
                  <p className="text-xs text-muted-foreground">Peso líquido</p>
                  <p className="text-lg font-bold text-primary">{ticket.peso_liquido ? formatKg(ticket.peso_liquido) : '—'}</p>
                </div>
                <div className="rounded-lg border p-3 col-span-2">
                  <p className="text-xs text-muted-foreground">Fechamento</p>
                  <p className="font-medium">{ticket.data_fechamento ? new Date(ticket.data_fechamento).toLocaleString('pt-BR') : '—'}</p>
                </div>
              </div>

              {pedido && (
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p className="text-xs text-muted-foreground mb-1">Pedido vinculado</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-medium truncate">{clienteNome(pedido.cliente_id)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Produto:</span><span className="font-medium truncate">{produtoNome(pedido.produto_id)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo do pedido:</span><span className="font-semibold">{formatKg(pedido.saldo_kg || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor total:</span><span className="font-semibold">{formatMoeda(pedido.valor_total)}</span></div>
                </div>
              )}

              {ticket.observacao && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Observação</p>
                  <p className="whitespace-pre-wrap">{ticket.observacao}</p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}