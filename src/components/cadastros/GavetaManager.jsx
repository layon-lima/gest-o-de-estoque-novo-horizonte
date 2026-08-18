import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import SearchInput from './SearchInput';
import { sortGavetas } from '@/lib/gavetas';

export default function GavetaManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ codigo: '', descricao: '' });
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');

  const filteredItems = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return sortGavetas(items);
    return items.filter((g) =>
      (g.codigo || '').toLowerCase().includes(q) ||
      (g.descricao || '').toLowerCase().includes(q)
    );
  }, [items, busca]);

  async function load() {
    setLoading(true);
    setItems(await base44.entities.Gaveta.list());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingId) await base44.entities.Gaveta.update(editingId, form);
    else await base44.entities.Gaveta.create(form);
    setForm({ codigo: '', descricao: '' });
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await base44.entities.Gaveta.delete(id);
    load();
  }

  function handleEdit(item) {
    setForm({ codigo: item.codigo, descricao: item.descricao || '' });
    setEditingId(item.id);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-4">{editingId ? 'Editar Gaveta' : 'Nova Gaveta'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-cod">Código *</Label>
            <Input id="g-cod" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Descrição</Label>
            <Input id="g-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ codigo: '', descricao: '' }); }}>Cancelar</Button>}
          </div>
        </form>
      </Card>

      <div className="md:col-span-2 space-y-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar gaveta por código, descrição ou máquina..." />
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && filteredItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma gaveta encontrada.</p>}
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{item.codigo}</span>
                  <p className="font-medium truncate">{item.descricao || '—'}</p>
                </div>
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