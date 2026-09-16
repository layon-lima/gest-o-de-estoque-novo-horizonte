import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Search } from 'lucide-react';
import SearchSelect from '@/components/SearchSelect';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { formatQtd } from '@/lib/format';
import { formatarNumeroOS, maxNumeroOS, calcularPrevisto, stringifyItens, parseItens, saldoProduto } from '@/lib/osAplicacao';
import { invalidateEntidade } from '@/lib/useEntidades';

const emptyForm = {
  cultura_id: '',
  ano_safra: '',
  lavoura_id: '',
  observacao: '',
};

export default function OsAplicacaoForm({ open, onOpenChange, onSaved, culturas, lavouras, produtos, saldos, depositos, ordens, os = null }) {
  const editing = !!os;
  const [form, setForm] = useState(emptyForm);
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Pré-preenche o formulário: edita a OS recebida ou limpa para criar nova.
  useEffect(() => {
    if (!open) return;
    if (os) {
      setForm({
        cultura_id: os.cultura_id || '',
        ano_safra: os.ano_safra || '',
        lavoura_id: os.lavoura_id || '',
        observacao: os.observacao || '',
      });
      setItens(
        parseItens(os.itens).map((it) => ({
          produto_id: it.produto_id,
          codigo: it.codigo,
          nome: it.nome,
          unidade: it.unidade || 'un',
          dose_por_hect: it.dose_por_hect || 0,
          previsto: it.previsto || 0,
          deposito_id: it.deposito_id || '',
          custo_unitario: Number(it.custo_unitario) || 0,
        }))
      );
    } else {
      setForm(emptyForm);
      setItens([]);
    }
    setBusca('');
    setConfirmOpen(false);
  }, [open, os]);

  const hectares = useMemo(() => {
    const lav = lavouras.find((l) => l.id === form.lavoura_id);
    return lav?.hectares || 0;
  }, [form.lavoura_id, lavouras]);

  // Produtos com saldo disponíveis para seleção.
  const produtosDisponiveis = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return produtos
      .filter((p) => saldoProduto(p.id, saldos) > 0)
      .filter((p) => !itens.some((it) => it.produto_id === p.id))
      .filter((p) => !q || (p.nome || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q));
  }, [produtos, saldos, itens, busca]);

  function addProduto(produto) {
    const depositoId = produto.deposito_id || '';
    setItens((prev) => [
      ...prev,
      {
        produto_id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        unidade: produto.unidade || 'un',
        dose_por_hect: 0,
        previsto: 0,
        deposito_id: depositoId,
        custo_unitario: Number(produto.custo_unitario) || 0,
      },
    ]);
    setBusca('');
  }

  function updateItem(idx, key, val) {
    setItens((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      if (key === 'dose_por_hect') {
        next[idx].previsto = calcularPrevisto(val, hectares);
      }
      return next;
    });
  }

  function removeItem(idx) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  // Recalcula previsto quando hectares muda.
  useEffect(() => {
    setItens((prev) =>
      prev.map((it) => ({ ...it, previsto: calcularPrevisto(it.dose_por_hect, hectares) }))
    );
  }, [hectares]);

  function validate() {
    if (!form.cultura_id) {
      toast({ variant: 'destructive', title: 'Selecione a cultura' });
      return false;
    }
    if (!form.lavoura_id) {
      toast({ variant: 'destructive', title: 'Selecione a lavoura' });
      return false;
    }
    if (!form.ano_safra.trim()) {
      toast({ variant: 'destructive', title: 'Informe o ano safra' });
      return false;
    }
    if (itens.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione ao menos um produto' });
      return false;
    }
    if (hectares <= 0) {
      toast({ variant: 'destructive', title: 'Lavoura sem hectares definidos' });
      return false;
    }
    return true;
  }

  async function persist() {
    setSaving(true);
    try {
      const cultura = culturas.find((c) => c.id === form.cultura_id);
      const lavoura = lavouras.find((l) => l.id === form.lavoura_id);

      if (editing) {
        await base44.entities.OrdemServicoAplicacao.update(os.id, {
          cultura_id: form.cultura_id,
          cultura_nome: cultura?.nome || '',
          ano_safra: form.ano_safra.trim(),
          lavoura_id: form.lavoura_id,
          lavoura_nome: lavoura?.nome || '',
          hectares,
          itens: stringifyItens(itens),
          observacao: form.observacao,
        });
        toast({ title: 'OS atualizada', description: os.numero });
      } else {
        const numero = formatarNumeroOS(maxNumeroOS(ordens) + 1);
        await base44.entities.OrdemServicoAplicacao.create({
          numero,
          cultura_id: form.cultura_id,
          cultura_nome: cultura?.nome || '',
          ano_safra: form.ano_safra.trim(),
          lavoura_id: form.lavoura_id,
          lavoura_nome: lavoura?.nome || '',
          hectares,
          itens: stringifyItens(itens),
          status: 'aberta',
          data: new Date().toISOString(),
          responsavel: user?.full_name || user?.email || '',
          observacao: form.observacao,
          custo_total: 0,
        });
        toast({ title: 'OS criada', description: numero });
      }

      invalidateEntidade('OrdemServicoAplicacao');
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    // Edição exige validação (confirmação) antes de aplicar.
    if (editing) {
      setConfirmOpen(true);
    } else {
      persist();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar OS ${os.numero}` : 'Nova Ordem de Serviço de Aplicação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Cultura *</Label>
              <SearchSelect
                value={form.cultura_id}
                onChange={(v) => setForm({ ...form, cultura_id: v === 'all' ? '' : v })}
                allLabel="— Selecione —"
                placeholder="Buscar cultura..."
                options={culturas.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ano Safra *</Label>
              <Input value={form.ano_safra} onChange={(e) => setForm({ ...form, ano_safra: e.target.value })} placeholder="Ex.: 2025/2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Lavoura *</Label>
              <SearchSelect
                value={form.lavoura_id}
                onChange={(v) => setForm({ ...form, lavoura_id: v === 'all' ? '' : v })}
                allLabel="— Selecione —"
                placeholder="Buscar lavoura..."
                options={lavouras.map((l) => ({ value: l.id, label: `${l.nome}${l.numero ? ' (Nº ' + l.numero + ')' : ''}` }))}
              />
            </div>
          </div>

          {hectares > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Badge className="bg-primary/15 text-primary border-transparent">Hectares: {formatQtd(hectares)} ha</Badge>
              <span className="text-muted-foreground">O previsto é calculado automaticamente (dose × hectares).</span>
            </div>
          )}

          {/* Seleção de produtos */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label>Adicionar produtos (com saldo em estoque)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto por nome ou código..." className="pl-9" />
            </div>
            {busca && produtosDisponiveis.length > 0 && (
              <div className="max-h-40 overflow-auto scrollbar-thin space-y-1">
                {produtosDisponiveis.slice(0, 20).map((p) => (
                  <button key={p.id} type="button" onClick={() => addProduto(p)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent text-left">
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{p.nome}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.codigo}</span>
                    <Badge variant="secondary" className="text-xs">Saldo: {formatQtd(saldoProduto(p.id, saldos))} {p.unidade}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabela de itens */}
          {itens.length > 0 && (
            <div className="border rounded-lg overflow-x-auto scrollbar-thin">
              <table className="min-w-full w-auto text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap">Produto</th>
                    <th className="p-2 text-center whitespace-nowrap">Un.</th>
                    <th className="p-2 text-right whitespace-nowrap">Dose/ha</th>
                    <th className="p-2 text-right whitespace-nowrap">Previsto</th>
                    <th className="p-2 text-center whitespace-nowrap">Depósito</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => {
                    return (
                      <tr key={idx} className="border-t">
                        <td className="p-2 whitespace-nowrap">
                          <span className="font-medium">{it.nome}</span>
                          <span className="text-xs text-muted-foreground ml-1 font-mono">{it.codigo}</span>
                        </td>
                        <td className="p-2 text-center whitespace-nowrap">{it.unidade}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <Input type="text" inputMode="decimal" className="h-8 w-24 text-right" value={it.dose_por_hect} onChange={(e) => updateItem(idx, 'dose_por_hect', e.target.value)} />
                        </td>
                        <td className="p-2 text-right whitespace-nowrap font-semibold tabular-nums">{formatQtd(it.previsto)}</td>
                        <td className="p-2 whitespace-nowrap">
                          <SearchSelect
                            value={it.deposito_id}
                            onChange={(v) => updateItem(idx, 'deposito_id', v === 'all' ? '' : v)}
                            allLabel="— Selecione —"
                            placeholder="Depósito..."
                            options={depositos
                              .filter((d) => saldoProduto(it.produto_id, saldos.filter((s) => s.deposito_id === d.id)) > 0)
                              .map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' · ' + d.nome : ''}` }))}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar Alterações' : 'Criar OS'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações na OS?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está editando a OS <b className="font-mono">{os?.numero}</b>. Os produtos, doses e depósitos serão atualizados. Deseja confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={persist} disabled={saving}>
              {saving ? 'Salvando…' : 'Confirmar alterações'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}