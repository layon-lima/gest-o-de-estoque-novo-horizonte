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

export default function PedidoDetalheDialog({ pedido, pessoas, produtos, tickets, onClose }) {
  const open = !!pedido;
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';

  const ticketsDoPedido = (pedido ? (tickets || []).filter((t) => t.pedido_id === pedido.id) : [])
    .sort((a, b) => new Date(b.data_abertura) - new Date(a.data_abertura));

  const pct = pedido && pedido.total_kg > 0 ? Math.max(0, Math.min(100, ((pedido.saldo_kg || 0) / pedido.total_kg) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        {pedido && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">Detalhes do Pedido</DialogTitle>
              <DialogDescription>Criado para <b>{clienteNome(pedido.cliente_id)}</b></DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={pedido.status === 'aberto' ? 'default' : 'secondary'} className="capitalize">{pedido.status}</Badge>
                <span className="text-xs text-muted-foreground">Saldo: <b className="text-foreground">{formatKg(pedido.saldo_kg || 0)}</b> de {formatKg(pedido.total_kg || 0)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium truncate">{clienteNome(pedido.cliente_id)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Produto</p>
                  <p className="font-medium truncate">{produtoNome(pedido.produto_id)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Sacas</p>
                  <p className="font-semibold">{formatQtd(pedido.qtd_sacas || 0)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Peso/saca</p>
                  <p className="font-semibold">{formatKg(pedido.peso_saca_kg || 0)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor/saca</p>
                  <p className="font-semibold">{formatMoeda(pedido.valor_saca)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor total</p>
                  <p className="font-semibold">{formatMoeda(pedido.valor_total)}</p>
                </div>
              </div>

              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>

              {pedido.observacao && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Observação</p>
                  <p className="whitespace-pre-wrap">{pedido.observacao}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">Tickets vinculados ({ticketsDoPedido.length})</h4>
                {ticketsDoPedido.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum ticket vinculado.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-auto scrollbar-thin">
                    {ticketsDoPedido.map((t) => (
                      <div key={t.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-xs">{t.numero}</span>
                          <Badge variant={t.status === 'aberto' ? 'default' : 'secondary'} className="text-[10px] capitalize">{t.status}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <span className="font-medium text-foreground truncate">{t.motorista}</span>
                          <span className="font-mono">{formatPlaca(t.placa)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Tara <b className="text-foreground">{formatKg(t.peso_tara)}</b></span>
                          {t.peso_liquido ? <span>Líq. <b className="text-foreground">{formatKg(t.peso_liquido)}</b></span> : null}
                          <span className="truncate">{t.data_fechamento ? new Date(t.data_fechamento).toLocaleString('pt-BR') : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}