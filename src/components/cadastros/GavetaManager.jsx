import { useState, useMemo } from 'react';
import { Pencil, Trash2, MapPin, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import SearchInput from './SearchInput';
import { sortGavetas } from '@/lib/gavetas';
import { formatQtd } from '@/lib/format';

const norm = (v) => String(v || '').trim().toLowerCase();

// Calcula ocupação derivada de cada gaveta a partir dos saldos dos produtos e lotes.
function ocupacaoPorGaveta(gavetas, produtos, lotes) {
  const map = new Map();
  for (const g of gavetas) {
    map.set(g.id, { itens: [], totalProdutos: 0, totalSaldo: 0 });
  }
  // Produtos sem lote (controle não-FEFO) guardam saldo diretamente.
  for (const p of produtos) {
    if (!p.gaveta_id) continue;
    const ocp = map.get(p.gaveta_id);
    if (!ocp) continue;
    const qtd = p.quantidade || 0;
    if (qtd > 0) {
      ocp.itens.push({ nome: p.nome, codigo: p.codigo, quantidade: qtd, unidade: p.unidade || 'un', validade: null });
      ocp.totalProdutos += 1;
      ocp.totalSaldo += qtd;
    }
  }
  // Lotes (FEFO) — somam ao mesmo endereço, com validade para rastreabilidade.
  for (const l of lotes) {
    if (!l.gaveta_id) continue;
    const ocp = map.get(l.gaveta_id);
    if (!ocp) continue;
    const qtd = l.quantidade || 0;
    if (qtd <= 0) continue;
    const prod = produtos.find((p) => p.id === l.produto_id);
    ocp.itens.push({
      nome: prod?.nome || '—',
      codigo: prod?.codigo || '',
      quantidade: qtd,
      unidade: l.unidade || prod?.unidade || 'un',
      validade: l.data_validade || null,
      lote: l.codigo_lote || '',
    });
    ocp.totalSaldo += qtd;
  }
  // Conta produtos distintos por gaveta.
  for (const [id, ocp] of map) {
    const unicos = new Set(ocp.itens.map((i) => i.codigo || i.nome));
    ocp.totalProdutos = unicos.size;
  }
  return map;
}

export default function GavetaManager() {
  const [form, setForm] = useState({ codigo: '', descricao: '', deposito_id: '' });
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const { data } = useEntidades({ Gaveta: {}, Produto: {}, Lote: {}, Deposito: {} });
  const items = data.Gaveta || [];
  const produtos = data.Produto || [];
  const lotes = data.Lote || [];
  const depositos = data.Deposito || [];
  const loading = false;

  const ocupacao = useMemo(
    () => ocupacaoPorGaveta(items, produtos, lotes),
    [items, produtos, lotes]
  );

  const filteredItems = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const sorted = sortGavetas(items);
    if (!q) return sorted;
    return sorted.filter((g) =>
      (g.codigo || '').toLowerCase().includes(q) ||
      (g.descricao || '').toLowerCase().includes(q)
    );
  }, [items, busca]);

  async function handleSubmit(e) {
    e.preventDefault();
    const duplicado = items.some((g) => norm(g.codigo) === norm(form.codigo) && g.id !== editingId);
    if (duplicado) {
      toast({
        variant: 'destructive',
        title: 'Gaveta duplicada',
        description: `Já existe uma gaveta com o código "${form.codigo}". Gavetas são endereços físicos e não podem ser repetidos.`,
      });
      return;
    }
    if (editingId) await base44.entities.Gaveta.update(editingId, form);
    else await base44.entities.Gaveta.create(form);
    setForm({ codigo: '', descricao: '', deposito_id: '' });
    setEditingId(null);
    invalidateEntidade('Gaveta');
  }

  async function handleDelete(id) {
    const ocp = ocupacao.get(id);
    if (ocp && ocp.totalProdutos > 0) {
      toast({
        variant: 'destructive',
        title: 'Gaveta ocupada',
        description: 'Esta gaveta ainda contém produtos com saldo. Zere o estoque ou mova os produtos antes de excluir o endereço.',
      });
      return;
    }
    await base44.entities.Gaveta.delete(id);
    invalidateEntidade('Gaveta');
  }

  function handleEdit(item) {
    setForm({ codigo: item.codigo, descricao: item.descricao || '', deposito_id: item.deposito_id || '' });
    setEditingId(item.id);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-1">{editingId ? 'Editar Gaveta' : 'Nova Gaveta'}</h3>
        <p className="text-xs text-muted-foreground mb-4">Endereço físico onde os produtos e lotes ficam guardados.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-cod">Código *</Label>
            <Input id="g-cod" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Descrição</Label>
            <Input id="g-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Depósito <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
            <Select value={form.deposito_id || 'none'} onValueChange={(v) => setForm({ ...form, deposito_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {depositos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.numero}{d.nome ? ` · ${d.nome}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ codigo: '', descricao: '', deposito_id: '' }); }}>Cancelar</Button>}
          </div>
        </form>
      </Card>

      <div className="md:col-span-2 space-y-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar gaveta por código ou descrição..." />
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && filteredItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma gaveta encontrada.</p>}
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const ocp = ocupacao.get(item.id) || { itens: [], totalProdutos: 0, totalSaldo: 0 };
            const vazia = ocp.totalProdutos === 0;
            return (
              <Card key={item.id} className={`p-4 flex items-center gap-3 hover:shadow-sm transition-shadow ${vazia ? 'border-dashed' : ''}`}>
                <div className={`shrink-0 w-9 h-9 rounded-md flex items-center justify-center ${vazia ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                  {vazia ? <MapPin className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{item.codigo}</span>
                    {vazia ? (
                      <Badge variant="outline" className="text-muted-foreground border-dashed">Vazia / disponível</Badge>
                    ) : (
                      <Badge variant="secondary">{ocp.totalProdutos} produto{ocp.totalProdutos > 1 ? 's' : ''}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">{item.descricao || '—'}</span>
                  </div>
                  {!vazia && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {ocp.itens.slice(0, 3).map((it, i) => (
                        <span key={i} className="truncate">
                          {it.nome}: <span className="font-medium text-foreground tabular-nums">{formatQtd(it.quantidade)} {it.unidade}</span>
                        </span>
                      ))}
                      {ocp.itens.length > 3 && <span>+{ocp.itens.length - 3} item(ns)</span>}
                    </div>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}