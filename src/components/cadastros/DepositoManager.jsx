import { useState, useMemo } from 'react';
import { Pencil, Trash2, Layers } from 'lucide-react';
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
import { nextDepositoNumber } from '@/lib/depositos';

const emptyForm = { nome: '', setor_id: '', descricao: '' };

export default function DepositoManager() {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const { data } = useEntidades({ Deposito: {}, Setor: {} });
  const items = data.Deposito || [];
  const setores = data.Setor || [];
  const loading = false;

  const nomeSetor = (id) => setores.find((s) => s.id === id)?.nome || '—';

  const filteredItems = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const sorted = [...items].sort((a, b) => (a.numero || '').localeCompare(b.numero || ''));
    if (!q) return sorted;
    return sorted.filter((d) =>
      (d.numero || '').toLowerCase().includes(q) ||
      (d.nome || '').toLowerCase().includes(q) ||
      (d.descricao || '').toLowerCase().includes(q) ||
      nomeSetor(d.setor_id).toLowerCase().includes(q)
    );
  }, [items, busca, setores]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await base44.entities.Deposito.update(editingId, form);
      } else {
        const numero = nextDepositoNumber(items);
        await base44.entities.Deposito.create({ ...form, numero });
      }
      setForm(emptyForm);
      setEditingId(null);
      invalidateEntidade('Deposito');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar depósito', description: err?.message });
    }
  }

  async function handleDelete(id) {
    try {
      await base44.entities.Deposito.delete(id);
      invalidateEntidade('Deposito');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err?.message });
    }
  }

  function handleEdit(item) {
    setForm({ nome: item.nome || '', setor_id: item.setor_id || '', descricao: item.descricao || '' });
    setEditingId(item.id);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-1">{editingId ? 'Editar Depósito' : 'Novo Depósito'}</h3>
        <p className="text-xs text-muted-foreground mb-4">Agrupamento dentro de um setor. A numeração é automática e global.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Setor (categoria) <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
            <Select value={form.setor_id || 'none'} onValueChange={(v) => setForm({ ...form, setor_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-numero">Número</Label>
            <div id="d-numero" className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
              {editingId ? items.find((d) => d.id === editingId)?.numero : nextDepositoNumber(items)}
            </div>
            <p className="text-xs text-muted-foreground">Gerado automaticamente ao salvar.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-nome">Nome <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="d-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Galpão Principal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-desc">Descrição</Label>
            <Input id="d-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</Button>}
          </div>
        </form>
      </Card>

      <div className="md:col-span-2 space-y-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar depósito por número, nome, descrição ou setor..." />
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && filteredItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum depósito encontrado.</p>}
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
              <div className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-primary/10 text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{item.numero}</span>
                  {item.nome && <p className="font-medium truncate">{item.nome}</p>}
                  <Badge variant="outline">{nomeSetor(item.setor_id)}</Badge>
                </div>
                {item.descricao && <p className="text-sm text-muted-foreground truncate mt-0.5">{item.descricao}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}