import { useState } from 'react';
import { Plus, Pencil, Trash2, Sprout, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import { safeDelete } from '@/lib/entityOps';
import { formatQtd } from '@/lib/format';

export default function LavourasManager() {
  const { data } = useEntidades({ Cultura: {}, Lavoura: {} });
  const culturas = data.Cultura || [];
  const lavouras = data.Lavoura || [];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <CulturasPanel culturas={culturas} />
      <LavourasPanel lavouras={lavouras} culturas={culturas} />
    </div>
  );
}

function CulturasPanel({ culturas }) {
  const [form, setForm] = useState({ nome: '' });
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }
    if (editingId) {
      await base44.entities.Cultura.update(editingId, form);
      toast({ title: 'Cultura atualizada' });
    } else {
      await base44.entities.Cultura.create(form);
      toast({ title: 'Cultura cadastrada' });
    }
    setForm({ nome: '' });
    setEditingId(null);
    invalidateEntidade('Cultura');
  }

  async function handleDelete(id) {
    try {
      await safeDelete('Cultura', id);
      toast({ title: 'Cultura removida' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: String(err?.message || err) });
    }
  }

  return (
    <Card className="p-5 h-fit">
      <div className="flex items-center gap-2 mb-4">
        <Sprout className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Culturas</h3>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <Input value={form.nome} onChange={(e) => setForm({ nome: e.target.value })} placeholder="Ex.: Milho, Soja, Algodão..." required />
        <Button type="submit">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
        {editingId && (
          <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ nome: '' }); }}>Cancelar</Button>
        )}
      </form>
      <div className="space-y-1.5 max-h-[50vh] overflow-auto scrollbar-thin">
        {culturas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma cultura cadastrada.</p>
        ) : (
          culturas.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent/40">
              <Sprout className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm">{c.nome}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm({ nome: c.nome }); setEditingId(c.id); }}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function LavourasPanel({ lavouras, culturas }) {
  const [form, setForm] = useState({ nome: '', numero: '', area_km2: '' });
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const hectaresCalculado = (Number(String(form.area_km2).replace(',', '.')) || 0) * 100;

  const filtered = lavouras.filter((l) => {
    const q = busca.toLowerCase().trim();
    if (!q) return true;
    return [l.nome, l.numero].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }
    const payload = { ...form, hectares: hectaresCalculado };
    delete payload.area_km2;
    if (editingId) {
      await base44.entities.Lavoura.update(editingId, payload);
      toast({ title: 'Lavoura atualizada' });
    } else {
      await base44.entities.Lavoura.create(payload);
      toast({ title: 'Lavoura cadastrada' });
    }
    setForm({ nome: '', numero: '', area_km2: '' });
    setEditingId(null);
    invalidateEntidade('Lavoura');
  }

  async function handleDelete(id) {
    try {
      await safeDelete('Lavoura', id);
      toast({ title: 'Lavoura removida' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: String(err?.message || err) });
    }
  }

  return (
    <Card className="p-5 h-fit">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Lavouras</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 mb-4">
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Fazenda Santa Helena - Talhão A" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Número</Label>
            <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Nº" />
          </div>
          <div className="space-y-1.5">
            <Label>Área (km²)</Label>
            <Input type="text" inputMode="decimal" placeholder="0,00" value={form.area_km2} onChange={(e) => setForm({ ...form, area_km2: e.target.value })} />
            {hectaresCalculado > 0 && (
              <p className="text-xs text-primary font-medium">{formatQtd(hectaresCalculado)} ha</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1"><Plus className="w-4 h-4 mr-1" />{editingId ? 'Atualizar' : 'Adicionar'}</Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ nome: '', numero: '', area_km2: '' }); }}>Cancelar</Button>
          )}
        </div>
      </form>

      <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lavoura..." className="mb-3" />
      <div className="space-y-2 max-h-[40vh] overflow-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma lavoura cadastrada.</p>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{l.nome}</p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {l.numero && <span>Nº {l.numero}</span>}
                  <span>{formatQtd(l.hectares || 0)} ha</span>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setForm({ nome: l.nome, numero: l.numero || '', area_km2: l.hectares ? (l.hectares / 100).toString().replace('.', ',') : '' }); setEditingId(l.id); }}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => handleDelete(l.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}