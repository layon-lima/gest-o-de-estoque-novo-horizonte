import { useState, useMemo, useEffect } from 'react';
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
import { parseQtd, formatQtd } from '@/lib/format';
import { calcLiquido, formatKg, formatMoeda, formatPlaca } from '@/lib/pesagem';

export default function FechamentoTicketDialog({ ticket, pedidos, pessoas, produtos, transportadoras, open, onClose, onClosed }) {
  const [pesoBruto, setPesoBruto] = useState('');
  const [pedidoId, setPedidoId] = useState('');
  const [transportadoraId, setTransportadoraId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isVenda = (ticket?.tipo || 'avulsa') === 'venda';
  const pedidosAbertos = isVenda ? pedidos.filter((p) => p.status === 'aberto') : [];

  const liquido = useMemo(
    () => calcLiquido(pesoBruto, ticket?.peso_tara || 0),
    [pesoBruto, ticket]
  );

  const pedidoSel = pedidos.find((p) => p.id === pedidoId);
  const saldo = pedidoSel?.saldo_kg || 0;
  const excede = pedidoSel && liquido > saldo;
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';
  const transpNome = (id) => transportadoras.find((t) => t.id === id)?.nome || '—';

  const transpsDoPedido = useMemo(() => {
    if (!pedidoSel) return [];
    const ids = (pedidoSel.transportadora_ids || '').split(',').map((s) => s.trim()).filter(Boolean);
    return ids.map((id) => transportadoras.find((t) => t.id === id)).filter(Boolean);
  }, [pedidoSel, transportadoras]);

  // Pré-seleciona a transportadora quando há apenas uma no pedido.
  useEffect(() => {
    if (transpsDoPedido.length === 1) setTransportadoraId(transpsDoPedido[0].id);
    else if (transpsDoPedido.length === 0) setTransportadoraId('');
  }, [transpsDoPedido]);

  function reset() {
    setPesoBruto('');
    setPedidoId('');
    setTransportadoraId('');
    setObservacao('');
    setConfirmOpen(false);
  }

  async function confirmarFechamento() {
    setSaving(true);
    try {
      const novoSaldo = Math.round((saldo - liquido) * 1000) / 1000;
      const transpId = isVenda ? transportadoraId : '';
      await base44.entities.TicketPesagem.update(ticket.id, {
        peso_bruto: parseQtd(pesoBruto),
        peso_liquido: liquido,
        pedido_id: isVenda ? pedidoId : '',
        produto_id: isVenda && pedidoSel ? pedidoSel.produto_id : (ticket.produto_id || ''),
        transportadora_id: transpId,
        transportadora_nome: transpId ? transpNome(transpId) : (ticket.transportadora_nome || ''),
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        observacao: observacao || '',
      });
      if (isVenda) {
        await base44.entities.PedidoPesagem.update(pedidoId, {
          saldo_kg: novoSaldo,
          status: novoSaldo <= 0 ? 'concluido' : 'aberto',
        });
      }
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
    if (isVenda && !pedidoId) {
      toast({ variant: 'destructive', title: 'Selecione um pedido' });
      return;
    }
    if (isVenda && transpsDoPedido.length > 1 && !transportadoraId) {
      toast({ variant: 'destructive', title: 'Selecione a transportadora' });
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
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Fechar Ticket {ticket.numero}</DialogTitle>
          <DialogDescription>Registre o peso bruto{isVenda ? ' e vincule um pedido' : ''} para concluir a pesagem.</DialogDescription>
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

          {isVenda && (
          <div className="space-y-1.5">
            <Label>Pedido *</Label>
            {pedidosAbertos.length === 0 ? (
              <p className="text-sm text-destructive">Nenhum pedido aberto disponível. Cadastre um pedido antes de fechar.</p>
            ) : (
              <div className="space-y-2">
                {pedidosAbertos.map((p) => {
                  const selected = p.id === pedidoId;
                  const consumoExcede = liquido > (p.saldo_kg || 0);
                  const pesoSaca = p.peso_saca_kg || 0;
                  const saldoSacas = pesoSaca > 0 ? (p.saldo_kg || 0) / pesoSaca : 0;
                  const liquidoSacas = pesoSaca > 0 ? liquido / pesoSaca : 0;
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
                          <p className="text-xs text-muted-foreground truncate">{produtoNome(p.produto_id)} · {formatQtd(saldoSacas)} sacas disponível</p>
                        </div>
                        {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                      </div>
                      {selected && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <Badge variant={consumoExcede ? 'destructive' : 'secondary'} className={consumoExcede ? '' : 'bg-green-100 text-green-700'}>
                            {consumoExcede ? <><AlertTriangle className="w-3 h-3 mr-1" /> Excede saldo</> : 'Dentro do saldo'}
                          </Badge>
                          <span className="text-muted-foreground">Consumirá {formatQtd(liquidoSacas)} sacas</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {isVenda && pedidoSel && (() => {
            const ps = pedidoSel.peso_saca_kg || 0;
            const saldoSacas = ps > 0 ? saldo / ps : 0;
            return (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="rounded-md bg-primary/5 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Saldo restante</p>
                  <p className="text-lg font-bold text-primary leading-tight">{formatQtd(saldoSacas)} <span className="text-xs font-semibold">sacas</span></p>
                </div>
                <div className="flex justify-between items-center pt-1 text-sm">
                  <span className="text-muted-foreground">Valor da saca</span>
                  <span className="font-semibold">{formatMoeda(pedidoSel.valor_saca)}</span>
                </div>
              </div>
            );
          })()}

          {isVenda && transpsDoPedido.length > 1 && (
            <div className="space-y-1.5">
              <Label>Transportadora *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={transportadoraId}
                onChange={(e) => setTransportadoraId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {transpsDoPedido.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
          )}
          {isVenda && pedidoSel && transpsDoPedido.length === 1 && (
            <p className="text-xs text-muted-foreground">Transportadora: <b className="text-foreground">{transpsDoPedido[0].nome}</b></p>
          )}

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleConfirmar} disabled={saving || (isVenda && pedidosAbertos.length === 0)}>
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