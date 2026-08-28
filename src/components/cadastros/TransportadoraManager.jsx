import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';

const empty = { nome: '', documento: '', ie: '', telefone: '', cidade: '', uf: '', endereco: '', observacao: '' };

export default function TransportadoraManager() {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const { data } = useEntidades({ Transportadora: { sort: '-created_date', limit: 500 } });
  const transportadoras = data.Transportadora || [];

  const filtered = transportadoras.filter((p) => {
    const q = busca.toLowerCase().trim();
    return !q || [p.nome, p.documento, p.cidade, p.telefone].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }
    if (editingId) {
      await base44.entities.Transportadora.update(editingId, form);
      toast({ title: 'Transportadora atualizada' });
    } else {
      await base44.entities.Transportadora.create(form);
      toast({ title: 'Transportadora cadastrada' });
    }
    setForm(empty);
    setEditingId(null);
    invalidateEntidade('Transportadora');
  }

  function handleEdit(p) {
    setForm({
      nome: p.nome || '',
      documento: p.documento || '',
      ie: p.ie || '',
      telefone: p.telefone || '',
      cidade: p.cidade || '',
      uf: p.uf || '',
      endereco: p.endereco || '',
      observacao: p.observacao || '',
    });
    setEditingId(p.id);
  }

  async function handleDelete(id) {
    await base44.entities.Transportadora.delete(id);
    toast({ title: 'Transportadora removida' });
    invalidateEntidade('Transportadora');
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="p-5 h-fit">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> {editingId ? 'Editar Transportadora' : 'Nova Transportadora'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome / Razão Social *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CNPJ / CPF</Label>
              <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Inscrição Estadual</Label>
              <Input value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} placeholder="IE" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-1">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} className="uppercase" placeholder="SP" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, nº, bairro" />
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>
            )}
          </div>
        </form>
      </Card>

      <div className="lg:col-span-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, documento, cidade..." className="pl-9" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transportadora cadastrada.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto scrollbar-thin pr-1">
            {filtered.map((p) => (
              <Card key={p.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.nome}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      {p.documento && <span className="font-mono">{p.documento}</span>}
                      {p.ie && <span>IE: {p.ie}</span>}
                      {p.cidade && <span>{p.cidade}{p.uf ? `/${p.uf}` : ''}</span>}
                      {p.telefone && <span>{p.telefone}</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}