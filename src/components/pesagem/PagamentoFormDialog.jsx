import { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { parseQtd, formatQtd } from '@/lib/format';
import { formatMoeda, nextPagamentoNumber, round3 } from '@/lib/pesagem';

const FORMAS = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'outro', label: 'Outro' },
];

function nowLocalDateTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const empty = { pedido_id: '', valor: '', forma_pagamento: 'pix', data_pagamento: nowLocalDateTime(), observacao: '' };

export default function PagamentoFormDialog({ open, onClose, onSaved, pagamento, pedidos, pessoas, tickets, pagamentos }) {
  const isEdit = !!pagamento;
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    if (pagamento) {
      const dt = pagamento.data_pagamento ? new Date(pagamento.data_pagamento) : new Date();
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      setForm({
        pedido_id: pagamento.pedido_id || '',
        valor: String(pagamento.valor ?? ''),
        forma_pagamento: pagamento.forma_pagamento || 'pix',
        data_pagamento: dt.toISOString().slice(0, 16),
        observacao: pagamento.observacao || '',
      });
    } else {
      setForm({ ...empty, data_pagamento: nowLocalDateTime() });
    }
  }, [open, pagamento]);

  const pedidoSel = pedidos.find((p) => p.id === form.pedido_id);
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';

  const pedidosDisponiveis = useMemo(
    () => pedidos.filter((p) => p.status !== 'cancelado'),
    [pedidos]
  );

  const resumo = useMemo(() => {
    if (!pedidoSel) return null;
    const pesoSaca = pedidoSel.peso_saca_kg || 0;
    const valorSaca = pedidoSel.valor_saca || 0;
    const liquidoKg = (tickets || [])
      .filter((t) => t.pedido_id === pedidoSel.id && t.status === 'fechado')
      .reduce((sum, t) => sum + (Number(t.peso_liquido) || 0), 0);
    const sacasPesadas = pesoSaca > 0 ? liquidoKg / pesoSaca : 0;
    const valorPesado = round3(sacasPesadas * valorSaca);
    const totalPago = (pagamentos || [])
      .filter((p) => p.pedido_id === pedidoSel.id && (!isEdit || p.id !== pagamento?.id))
      .reduce((sum, p) => sum + (Number(p.valor) || 0), 0);
    const saldo = round3(valorPesado - totalPago);
    return { liquidoKg, sacasPesadas, valorPesado, totalPago: round3(totalPago), saldo };
  }, [pedidoSel, tickets, pagamentos, isEdit, pagamento]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.pedido_id) {
      toast({ variant: 'destructive', title: 'Selecione um pedido' });
      return;
    }
    if (parseQtd(form.valor) <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido', description: 'Informe um valor maior que zero.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        pedido_id: form.pedido_id,
        cliente_id: pedidoSel?.cliente_id || '',
        valor: parseQtd(form.valor),
        forma_pagamento: form.forma_pagamento,
        data_pagamento: new Date(form.data_pagamento).toISOString(),
        observacao: form.observacao || '',
      };
      if (isEdit) {
        await base44.entities.Pagamento.update(pagamento.id, payload);
        toast({ title: 'Pagamento atualizado' });
      } else {
        payload.numero = nextPagamentoNumber(pagamentos);
        await base44.entities.Pagamento.create(payload);
        toast({ title: 'Pagamento registrado' });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
            {isEdit ? 'Editar Pagamento' : 'Registrar Pagamento'}
          </DialogTitle>
          <DialogDescription>{isEdit ? 'Altere os dados do pagamento.' : 'Registre um pagamento recebido de um cliente.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pedido *</Label>
            <SearchSelect
              value={form.pedido_id}
              onChange={(v) => setForm({ ...form, pedido_id: v })}
              placeholder="Buscar pedido..."
              disabled={isEdit}
              options={pedidosDisponiveis.map((p) => ({ value: p.id, label: `${p.numero ? p.numero + ' · ' : ''}${clienteNome(p.cliente_id)}` }))}
            />
          </div>

          {resumo && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-medium truncate">{clienteNome(pedidoSel.cliente_id)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total pesado:</span><span className="font-semibold">{formatQtd(resumo.liquidoKg)} kg ({formatQtd(resumo.sacasPesadas)} sacas)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor do pesado:</span><span className="font-semibold">{formatMoeda(resumo.valorPesado)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Já pago:</span><span className="font-semibold text-amber-600">{formatMoeda(resumo.totalPago)}</span></div>
              <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground font-medium">Saldo a receber:</span><span className="font-bold text-primary">{formatMoeda(resumo.saldo)}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pg-valor">Valor Pago (R$) *</Label>
              <Input id="pg-valor" type="text" inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg-forma">Forma de Pagamento</Label>
              <SearchSelect
                value={form.forma_pagamento}
                onChange={(v) => setForm({ ...form, forma_pagamento: v })}
                placeholder="Forma de pagamento..."
                options={FORMAS.map((f) => ({ value: f.value, label: f.label }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pg-data">Data do Pagamento *</Label>
            <Input id="pg-data" type="datetime-local" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pg-obs">Observação</Label>
            <Textarea id="pg-obs" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Registrar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}