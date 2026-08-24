import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SearchInput from './SearchInput';

const norm = (v) => String(v || '').trim().toLowerCase();

const NOMES_VALIDADE = /defensivo|adubo|semente|fertilizante/;

export default function SetorManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: '', descricao: '', cor: '#16a34a', controla_validade: false, tem_aba_mobile: false });
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const filteredItems = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return items;
    return items.filter((s) =>
      (s.nome || '').toLowerCase().includes(q) ||
      (s.descricao || '').toLowerCase().includes(q)
    );
  }, [items, busca]);

  async function load() {
    setLoading(true);
    setItems(await base44.entities.Setor.list());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const duplicado = items.some((s) => norm(s.nome) === norm(form.nome) && s.id !== editingId);
    if (duplicado) {
      toast({
        variant: 'destructive',
        title: 'Setor duplicado',
        description: `Já existe um setor com o nome "${form.nome}".`,
      });
      return;
    }
    if (editingId) await base44.entities.Setor.update(editingId, form);
    else await base44.entities.Setor.create(form);
    setForm({ nome: '', descricao: '', cor: '#16a34a', controla_validade: false, tem_aba_mobile: false });
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await base44.entities.Setor.delete(id);
    load();
  }

  function handleEdit(item) {
    setForm({ nome: item.nome, descricao: item.descricao || '', cor: item.cor || '#16a34a', controla_validade: !!item.controla_validade, tem_aba_mobile: !!item.tem_aba_mobile });
    setEditingId(item.id);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-4">{editingId ? 'Editar Setor' : 'Novo Setor'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-nome">Nome *</Label>
            <Input id="s-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-desc">Descrição</Label>
            <Input id="s-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-cor">Cor</Label>
            <div className="flex items-center gap-2">
              <input type="color" id="s-cor" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="w-10 h-9 rounded border border-input cursor-pointer" />
              <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="flex-1" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="s-val" className="cursor-pointer">Controla validade (lotes)</Label>
              <p className="text-xs text-muted-foreground">Defensivos, adubos e sementes</p>
            </div>
            <Switch
              id="s-val"
              checked={!!form.controla_validade}
              onCheckedChange={(v) => setForm({ ...form, controla_validade: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="s-aba" className="cursor-pointer">Tem aba mobile</Label>
              <p className="text-xs text-muted-foreground">Aparece na aba mobile "Setores"</p>
            </div>
            <Switch
              id="s-aba"
              checked={!!form.tem_aba_mobile}
              onCheckedChange={(v) => setForm({ ...form, tem_aba_mobile: v })}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ nome: '', descricao: '', cor: '#16a34a', controla_validade: false, tem_aba_mobile: false }); }}>Cancelar</Button>}
          </div>
        </form>
      </Card>

      <div className="md:col-span-2 space-y-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar setor por nome ou descrição..." />
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && filteredItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum setor encontrado.</p>}
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.cor || '#16a34a' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{item.nome}</p>
                  {item.controla_validade && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0">Validade</Badge>
                  )}
                </div>
                {item.descricao && <p className="text-sm text-muted-foreground truncate">{item.descricao}</p>}
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