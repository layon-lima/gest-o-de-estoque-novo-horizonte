import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
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
import { parseQtd } from '@/lib/format';
import { calcTotalKg, calcValorTotal, formatKg, formatMoeda } from '@/lib/pesagem';

const empty = { cliente_id: '', produto_id: '', peso_saca_kg: '60', valor_saca: '0', qtd_sacas: '0', observacao: '' };

export default function PedidoFormDialog({ open, onClose, onSaved, pessoas, produtos }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const clientes = pessoas.filter((p) => p.is_cliente);
  const totalKg = useMemo(() => calcTotalKg(form.qtd_sacas, form.peso_saca_kg), [form.qtd_sacas, form.peso_saca_kg]);
  const valorTotal = useMemo(() => calcValorTotal(form.qtd_sacas, form.valor_saca), [form.qtd_sacas, form.valor_saca]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.cliente_id) {
      toast({ variant: 'destructive', title: 'Selecione um cliente' });
      return;
    }
    if (!form.produto_id) {
      toast({ variant: 'destructive', title: 'Selecione um produto' });
      return;
    }
    if (parseQtd(form.qtd_sacas) <= 0 || parseQtd(form.peso_saca_kg) <= 0) {
      toast({ variant: 'destructive', title: 'Quantidade e peso da saca devem ser maiores que zero' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.PedidoPesagem.create({
        cliente_id: form.cliente_id,
        produto_id: form.produto_id,
        peso_saca_kg: parseQtd(form.peso_saca_kg),
        valor_saca: parseQtd(form.valor_saca),
        qtd_sacas: parseQtd(form.qtd_sacas),
        total_kg: totalKg,
        valor_total: valorTotal,
        saldo_kg: totalKg,
        status: 'aberto',
        observacao: form.observacao || '',
      });
      toast({ title: 'Pedido cadastrado' });
      setForm(empty);
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao cadastrar', description: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Novo Pedido</DialogTitle>
          <DialogDescription>Preencha os dados do pedido de pesagem.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <SearchSelect
              value={form.cliente_id}
              onChange={(v) => setForm({ ...form, cliente_id: v })}
              options={clientes.map((c) => ({ value: c.id, label: `${c.nome}${c.documento ? ' — ' + c.documento : ''}` }))}
              placeholder="Buscar cliente..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Produto *</Label>
            <SearchSelect
              value={form.produto_id}
              onChange={(v) => setForm({ ...form, produto_id: v })}
              options={produtos.filter((p) => p.venda).map((p) => ({ value: p.id, label: `${p.codigo ? p.codigo + ' — ' : ''}${p.nome}` }))}
              placeholder="Buscar produto de venda..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Peso 1 saca (kg) *</Label>
              <Input type="text" inputMode="decimal" value={form.peso_saca_kg} onChange={(e) => setForm({ ...form, peso_saca_kg: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor saca (R$)</Label>
              <Input type="text" inputMode="decimal" value={form.valor_saca} onChange={(e) => setForm({ ...form, valor_saca: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade de sacas *</Label>
            <Input type="text" inputMode="decimal" value={form.qtd_sacas} onChange={(e) => setForm({ ...form, qtd_sacas: e.target.value })} />
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total equivalente:</span><span className="font-semibold">{formatKg(totalKg)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valor total:</span><span className="font-semibold">{formatMoeda(valorTotal)}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}