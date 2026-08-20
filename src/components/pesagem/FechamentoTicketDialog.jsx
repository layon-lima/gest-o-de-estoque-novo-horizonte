import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { parseQtd } from '@/lib/format';
import { calcLiquido, formatKg, formatMoeda, formatPlaca } from '@/lib/pesagem';

export default function FechamentoTicketDialog({ ticket, pedidos, pessoas, produtos, open, onClose, onClosed }) {
  const [pesoBruto, setPesoBruto] = useState('');
  const [pedidoId, setPedidoId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const pedidosAbertos = pedidos.filter((p) => p.status === 'aberto');

  const liquido = useMemo(
    () => calcLiquido(pesoBruto, ticket?.peso_tara || 0),
    [pesoBruto, ticket]
  );

  const pedidoSel = pedidos.find((p) => p.id === pedidoId);
  const saldo = pedidoSel?.saldo_kg || 0;
  const excede = pedidoSel && liquido > saldo;
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';

  function reset() {
    setPesoBruto('');
    setPedidoId('');
    setObservacao('');
    setConfirmOpen(false);
  }

  async function confirmarFechamento() {
    setSaving(true);
    try {
      const novoSaldo = Math.round((saldo - liquido) * 1000) / 1000;
      await base44.entities.TicketPesagem.update(ticket.id, {
        peso_bruto: parseQtd(pesoBruto),
        peso_liquido: liquido,
        pedido_id: pedidoId,
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        observacao: observacao || '',
      });
      await base44.entities.PedidoPesagem.update(pedidoId, {
        saldo_kg: novoSaldo,
        status: novoSaldo <= 0 ? 'concluido' : 'aberto',
      });
      toast({ title: 'Ticket fechado', description: `Líquido: ${formatKg(liquido)}` });
      reset();
      onClosed();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao fechar ticket', description: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  }

  function handleConfirmar() {
    if (parseQtd(pesoBruto) <= 0) {
      toast({ variant: 'destructive', title: 'Informe o peso bruto' });
      return;
    }
    if (parseQtd(pesoBruto) < (ticket?.peso_tara || 0)) {
      toast({ variant: 'destructive', title: 'Peso bruto menor que a tara' });
      return;
    }
    if (!pedidoId) {
      toast({ variant: 'destructive', title: 'Selecione um pedido' });
      return;
    }
    if (excede) {
      setConfirmOpen(true);
    } else {
      confirmarFechamento();
    }
  }

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Fechar Ticket {ticket.numero}</DialogTitle>
          <DialogDescription>Registre o peso bruto e vincule um pedido para concluir a pesagem.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Motorista</p>
              <p className="font-medium truncate">{ticket.motorista}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Placa</p>
              <p className="font-medium font-mono">{formatPlaca(ticket.placa)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Tara</p>
              <p className="font-semibold">{formatKg(ticket.peso_tara)}</p>
            </div>
            <div className="rounded-lg border p-3 bg-primary/5">
              <p className="text-xs text-muted-foreground">Abertura</p>
              <p className="text-xs">{ticket.data_abertura ? new Date(ticket.data_abertura).toLocaleString('pt-BR') : '—'}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Peso Bruto (kg) *</Label>
            <Input type="text" inputMode="decimal" value={pesoBruto} onChange={(e) => setPesoBruto(e.target.value)} placeholder="0,00" autoFocus />
          </div>

          {liquido > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Peso Líquido (calculado)</span>
              <span className="text-lg font-bold text-primary">{formatKg(liquido)}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Pedido *</Label>
            {pedidosAbertos.length === 0 ? (
              <p className="text-sm text-destructive">Nenhum pedido aberto disponível. Cadastre um pedido antes de fechar.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-auto scrollbar-thin">
                {pedidosAbertos.map((p) => {
                  const selected = p.id === pedidoId;
                  const consumoExcede = liquido > (p.saldo_kg || 0);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPedidoId(p.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'}`}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{clienteNome(p.cliente_id)}</p>
                          <p className="text-xs text-muted-foreground truncate">{produtoNome(p.produto_id)} · {formatKg(p.saldo_kg)} disponível</p>
                        </div>
                        {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                      </div>
                      {selected && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <Badge variant={consumoExcede ? 'destructive' : 'secondary'} className={consumoExcede ? '' : 'bg-green-100 text-green-700'}>
                            {consumoExcede ? <><AlertTriangle className="w-3 h-3 mr-1" /> Excede saldo</> : 'Dentro do saldo'}
                          </Badge>
                          <span className="text-muted-foreground">Consumirá {formatKg(liquido)}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pedidoSel && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo atual:</span><span className="font-semibold">{formatKg(saldo)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Após este ticket:</span><span className={`font-semibold ${excede ? 'text-destructive' : ''}`}>{formatKg(saldo - liquido)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor total pedido:</span><span>{formatMoeda(pedidoSel.valor_total)}</span></div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleConfirmar} disabled={saving || pedidosAbertos.length === 0}>
              {saving ? 'Fechando...' : 'Confirmar Fechamento'}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Saldo insuficiente</AlertDialogTitle>
            <AlertDialogDescription>
              O peso líquido ({formatKg(liquido)}) ultrapassa o saldo restante do pedido ({formatKg(saldo)}).
              O saldo ficará negativo em {formatKg(saldo - liquido)}. Deseja confirmar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarFechamento}>Confirmar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}