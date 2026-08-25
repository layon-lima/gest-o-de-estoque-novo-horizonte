import { useState } from 'react';
import { Printer, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatKg, formatMoeda, formatPlaca } from '@/lib/pesagem';
import { formatQtd } from '@/lib/format';
import { gerarTicketPDF } from '@/lib/ticketPdf';

const TIPO_LABEL = { venda: 'Venda', lavoura: 'Lavoura', avulsa: 'Avulsa' };

export default function TicketDetalheDialog({ ticket, pedidos, pessoas, produtos, onClose }) {
  const open = !!ticket;
  const [gerandoPdf, setGerandoPdf] = useState(null);
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';
  const pedido = ticket ? pedidos.find((p) => p.id === ticket.pedido_id) : null;

  async function handlePdf(opts) {
    if (!ticket) return;
    setGerandoPdf(opts.print ? 'print' : 'download');
    try {
      await gerarTicketPDF(ticket, { pedido, produtoNome, clienteNome }, opts);
    } finally {
      setGerandoPdf(null);
    }
  }

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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={ticket.status === 'aberto' ? 'default' : 'secondary'} className="capitalize">{ticket.status}</Badge>
                  {ticket.tipo && <Badge variant="outline">{TIPO_LABEL[ticket.tipo] || ticket.tipo}</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">Abertura: {ticket.data_abertura ? new Date(ticket.data_abertura).toLocaleString('pt-BR') : '—'}</span>
              </div>

              {ticket.tipo !== 'venda' && (ticket.produto_id || ticket.origem || ticket.destino) && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {ticket.produto_id && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Produto</p>
                      <p className="font-medium truncate">{produtoNome(ticket.produto_id)}</p>
                    </div>
                  )}
                  {ticket.origem && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Origem</p>
                      <p className="font-medium truncate">{ticket.origem}</p>
                    </div>
                  )}
                  {ticket.destino && (
                    <div className="rounded-lg border p-3 col-span-2">
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="font-medium truncate">{ticket.destino}</p>
                    </div>
                  )}
                </div>
              )}

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

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handlePdf({ print: true })} disabled={!!gerandoPdf}>
                {gerandoPdf === 'print' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />} Imprimir
              </Button>
              <Button className="flex-1" onClick={() => handlePdf({})} disabled={!!gerandoPdf}>
                {gerandoPdf === 'download' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Baixar PDF
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}