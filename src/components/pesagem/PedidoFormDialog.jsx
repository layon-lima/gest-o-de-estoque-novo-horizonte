import { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil, CheckCircle2 } from 'lucide-react';
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
import { calcTotalKg, calcValorTotal, formatKg, formatMoeda, somaLiquidoTickets, statusPorSaldo, round3, nextPedidoNumber } from '@/lib/pesagem';
import { Switch } from '@/components/ui/switch';
import { Infinity as InfinityIcon } from 'lucide-react';

const empty = { cliente_id: '', produto_id: '', peso_saca_kg: '60', valor_saca: '0', qtd_sacas: '0', transportadora_ids: [], observacao: '', sem_limite: false };

export default function PedidoFormDialog({ open, onClose, onSaved, pessoas, produtos, transportadoras, pedido, tickets, pedidos }) {
  const isEdit = !!pedido;
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    if (pedido) {
      setForm({
        cliente_id: pedido.cliente_id || '',
        produto_id: pedido.produto_id || '',
        peso_saca_kg: String(pedido.peso_saca_kg ?? '60'),
        valor_saca: String(pedido.valor_saca ?? '0'),
        qtd_sacas: String(pedido.qtd_sacas ?? '0'),
        transportadora_ids: (pedido.transportadora_ids || '').split(',').map((s) => s.trim()).filter(Boolean),
        observacao: pedido.observacao || '',
        sem_limite: !!pedido.sem_limite,
      });
    } else {
      setForm(empty);
    }
  }, [open, pedido]);

  const clientes = pessoas.filter((p) => p.is_cliente);
  const totalKg = useMemo(() => calcTotalKg(form.qtd_sacas, form.peso_saca_kg), [form.qtd_sacas, form.peso_saca_kg]);
  const valorTotal = useMemo(() => calcValorTotal(form.qtd_sacas, form.valor_saca), [form.qtd_sacas, form.valor_saca]);

  const carregadoKg = isEdit ? somaLiquidoTickets(tickets, pedido.id) : 0;

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
    if (!form.sem_limite && (parseQtd(form.qtd_sacas) <= 0 || parseQtd(form.peso_saca_kg) <= 0)) {
      toast({ variant: 'destructive', title: 'Quantidade e peso da saca devem ser maiores que zero' });
      return;
    }
    if (!form.sem_limite && isEdit && totalKg < carregadoKg - 0.001) {
      toast({
        variant: 'destructive',
        title: 'Total menor que o já carregado',
        description: `Já foram carregados ${formatKg(carregadoKg)} em tickets vinculados.`,
      });
      return;
    }
    setSaving(true);
    try {
      const transpIds = form.transportadora_ids || [];
      const transpNomes = transpIds.map((id) => transportadoras.find((t) => t.id === id)?.nome).filter(Boolean).join(', ');
      const semLimite = !!form.sem_limite;
      const payload = {
        cliente_id: form.cliente_id,
        produto_id: form.produto_id,
        sem_limite: semLimite,
        peso_saca_kg: parseQtd(form.peso_saca_kg),
        valor_saca: parseQtd(form.valor_saca),
        qtd_sacas: semLimite ? 0 : parseQtd(form.qtd_sacas),
        total_kg: semLimite ? 0 : totalKg,
        valor_total: semLimite ? 0 : valorTotal,
        transportadora_ids: transpIds.join(','),
        transportadora_nomes: transpNomes,
        observacao: form.observacao || '',
      };
      if (isEdit) {
        if (semLimite) {
          payload.saldo_kg = 0;
          payload.status = 'aberto';
        } else {
          const saldoKg = round3(totalKg - carregadoKg);
          payload.saldo_kg = saldoKg;
          payload.status = statusPorSaldo(saldoKg, totalKg, pedido.status);
        }
        await base44.entities.PedidoPesagem.update(pedido.id, payload);
        toast({ title: 'Pedido atualizado' });
      } else {
        payload.saldo_kg = semLimite ? 0 : totalKg;
        payload.status = 'aberto';
        payload.numero = nextPedidoNumber(pedidos);
        await base44.entities.PedidoPesagem.create(payload);
        toast({ title: 'Pedido cadastrado' });
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
            {isEdit ? 'Editar Pedido' : 'Novo Pedido'}
          </DialogTitle>
          <DialogDescription>{isEdit ? 'Altere os dados do pedido de pesagem.' : 'Preencha os dados do pedido de pesagem.'}</DialogDescription>
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
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <InfinityIcon className="w-4 h-4 text-sky-600" />
              <div>
                <Label className="cursor-pointer">Pedido sem limite</Label>
                <p className="text-xs text-muted-foreground">Não bloqueia por saldo — apenas conta o carregado.</p>
              </div>
            </div>
            <Switch checked={form.sem_limite} onCheckedChange={(v) => setForm({ ...form, sem_limite: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Peso 1 saca (kg)</Label>
              <Input type="text" inputMode="decimal" value={form.peso_saca_kg} onChange={(e) => setForm({ ...form, peso_saca_kg: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor saca (R$)</Label>
              <Input type="text" inputMode="decimal" value={form.valor_saca} onChange={(e) => setForm({ ...form, valor_saca: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade de sacas {form.sem_limite ? '' : '*'}</Label>
            <Input type="text" inputMode="decimal" value={form.qtd_sacas} onChange={(e) => setForm({ ...form, qtd_sacas: e.target.value })} disabled={form.sem_limite} />
          </div>
          <div className="space-y-1.5">
            <Label>Transportadora(s)</Label>
            <p className="text-xs text-muted-foreground -mt-1">Vincule uma ou mais transportadoras. Em tickets de venda com mais de uma, o usuário escolhe no fechamento.</p>
            {transportadoras.length === 0 ? (
              <p className="text-sm text-destructive">Nenhuma transportadora cadastrada. Cadastre em Cadastros → Pessoas marcando a flag Transportadora.</p>
            ) : (
              <div className="max-h-40 overflow-auto scrollbar-thin rounded-lg border p-2 space-y-1">
                {transportadoras.map((t) => {
                  const checked = form.transportadora_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        transportadora_ids: checked
                          ? f.transportadora_ids.filter((id) => id !== t.id)
                          : [...f.transportadora_ids, t.id],
                      }))}
                      className={`w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5 text-sm transition-colors ${checked ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-input'}`}>
                        {checked && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                      </span>
                      <span className="truncate">{t.nome}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            {form.sem_limite ? (
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="font-semibold text-sky-600">Sem limite de saldo</span></div>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Total equivalente:</span><span className="font-semibold">{formatKg(totalKg)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor total:</span><span className="font-semibold">{formatMoeda(valorTotal)}</span></div>
              </>
            )}
            {isEdit && (
              <div className="flex justify-between"><span className="text-muted-foreground">Já carregado:</span><span className="font-semibold text-amber-600">{formatKg(carregadoKg)}</span></div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}