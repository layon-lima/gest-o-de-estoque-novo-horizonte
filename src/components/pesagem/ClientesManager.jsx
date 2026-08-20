import { useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const empty = { nome: '', cnpj: '', telefone: '', cidade: '' };

export default function ClientesManager({ clientes, onReload }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const filtered = clientes.filter((c) => {
    const q = busca.toLowerCase().trim();
    if (!q) return true;
    return [c.nome, c.cnpj, c.cidade, c.telefone].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }
    if (editingId) {
      await base44.entities.Cliente.update(editingId, form);
      toast({ title: 'Cliente atualizado' });
    } else {
      await base44.entities.Cliente.create(form);
      toast({ title: 'Cliente cadastrado' });
    }
    setForm(empty);
    setEditingId(null);
    onReload();
  }

  function handleEdit(c) {
    setForm({ nome: c.nome || '', cnpj: c.cnpj || '', telefone: c.telefone || '', cidade: c.cidade || '' });
    setEditingId(c.id);
  }

  async function handleDelete(id) {
    await base44.entities.Cliente.delete(id);
    toast({ title: 'Cliente removido' });
    onReload();
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-4">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome / Razão Social *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
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
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente por nome, CNPJ, cidade..." className="pl-9" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <Card key={c.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.nome}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    {c.cnpj && <span className="font-mono">{c.cnpj}</span>}
                    {c.cidade && <span>{c.cidade}</span>}
                    {c.telefone && <span>{c.telefone}</span>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => handleEdit(c)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4" /></Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}