import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, QrCode, Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SearchInput from './SearchInput';
import FuelQrCard from '@/components/abastecimento/FuelQrCard';

const emptyForm = { codigo: '', nome: '', descricao: '', permite_abastecimento: false };

const norm = (v) => String(v || '').trim().toLowerCase();

export default function MaquinaManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const [qrMaquina, setQrMaquina] = useState(null);
  const { toast } = useToast();

  const filteredItems = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return items;
    return items.filter((m) =>
      (m.codigo || '').toLowerCase().includes(q) ||
      (m.nome || '').toLowerCase().includes(q) ||
      (m.descricao || '').toLowerCase().includes(q)
    );
  }, [items, busca]);

  async function load() {
    setLoading(true);
    setItems(await base44.entities.Maquina.list());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const duplicado = items.some((m) => norm(m.codigo) === norm(form.codigo) && m.id !== editingId);
    if (duplicado) {
      toast({
        variant: 'destructive',
        title: 'Máquina duplicada',
        description: `Já existe uma máquina com o código "${form.codigo}".`,
      });
      return;
    }
    let salva;
    if (editingId) {
      salva = await base44.entities.Maquina.update(editingId, form);
      salva = { ...form, id: editingId, ...salva };
    } else {
      salva = await base44.entities.Maquina.create(form);
    }
    setForm(emptyForm);
    setEditingId(null);
    await load();
    // Exibe o QR Code automaticamente após criar/editar, disponível para baixar.
    setQrMaquina(salva);
  }

  async function handleDelete(id) {
    await base44.entities.Maquina.delete(id);
    load();
  }

  function handleEdit(item) {
    setForm({ codigo: item.codigo, nome: item.nome, descricao: item.descricao || '', permite_abastecimento: item.permite_abastecimento === true });
    setEditingId(item.id);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-4">{editingId ? 'Editar Máquina' : 'Nova Máquina'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-cod">Código *</Label>
            <Input id="m-cod" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-nome">Nome / Descrição *</Label>
            <Input id="m-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Descrição</Label>
            <Input id="m-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="m-abast" className="cursor-pointer">Permite abastecimento</Label>
              <p className="text-xs text-muted-foreground">Marcada, a máquina aparece na tela de Abastecimento e o QR Code libera o registro de combustível.</p>
            </div>
            <Switch id="m-abast" checked={form.permite_abastecimento} onCheckedChange={(v) => setForm({ ...form, permite_abastecimento: v })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ codigo: '', nome: '', descricao: '' }); }}>Cancelar</Button>}
          </div>
        </form>
      </Card>

      <div className="md:col-span-2 space-y-3">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar máquina por código, nome ou descrição..." />
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && filteredItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma máquina encontrada.</p>}
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{item.codigo}</span>
                  <p className="font-medium truncate">{item.nome}</p>
                  {item.permite_abastecimento === true && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Fuel className="w-3 h-3 mr-1" />Abastece</Badge>
                  )}
                </div>
                {item.descricao && <p className="text-sm text-muted-foreground truncate mt-0.5">{item.descricao}</p>}
              </div>
              <Button size="icon" variant="ghost" title="QR Code" onClick={() => setQrMaquina(item)}><QrCode className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
            </Card>
          ))}
        </div>
      </div>

      <FuelQrCard maquina={qrMaquina} open={!!qrMaquina} onClose={() => setQrMaquina(null)} />
    </div>
  );
}