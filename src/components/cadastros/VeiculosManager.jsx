import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import SearchSelect from '@/components/SearchSelect';

const empty = {
  placa: '',
  modelo: '',
  cor: '',
  ano: '',
  tara: '',
  capacidade_kg: '',
  transportadora_id: '',
  motorista_id: '',
  observacao: '',
};

export default function VeiculosManager() {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const { data } = useEntidades({
    Veiculo: { sort: '-created_date', limit: 500 },
    Transportadora: { sort: '-created_date', limit: 500 },
    Pessoa: { sort: '-created_date', limit: 500 },
  });
  const veiculos = data.Veiculo || [];
  const transportadoras = data.Transportadora || [];
  const motoristas = (data.Pessoa || []).filter((p) => p.is_motorista);

  const nomeTransp = (id) => transportadoras.find((t) => t.id === id)?.nome || '';
  const nomeMotorista = (id) => motoristas.find((m) => m.id === id)?.nome || '';

  const filtered = veiculos.filter((v) => {
    const q = busca.toLowerCase().trim();
    return (
      !q ||
      [v.placa, v.modelo, v.cor, v.ano, nomeTransp(v.transportadora_id), nomeMotorista(v.motorista_id)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.placa.trim()) {
      toast({ variant: 'destructive', title: 'Placa obrigatória' });
      return;
    }
    const payload = {
      ...form,
      placa: form.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      tara: Number(form.tara) || 0,
      capacidade_kg: Number(form.capacidade_kg) || 0,
    };
    if (editingId) {
      await base44.entities.Veiculo.update(editingId, payload);
      toast({ title: 'Veículo atualizado' });
    } else {
      await base44.entities.Veiculo.create(payload);
      toast({ title: 'Veículo cadastrado' });
    }
    setForm(empty);
    setEditingId(null);
    invalidateEntidade('Veiculo');
  }

  function handleEdit(v) {
    setForm({
      placa: v.placa || '',
      modelo: v.modelo || '',
      cor: v.cor || '',
      ano: v.ano || '',
      tara: v.tara ?? '',
      capacidade_kg: v.capacidade_kg ?? '',
      transportadora_id: v.transportadora_id || '',
      motorista_id: v.motorista_id || '',
      observacao: v.observacao || '',
    });
    setEditingId(v.id);
  }

  async function handleDelete(id) {
    await base44.entities.Veiculo.delete(id);
    toast({ title: 'Veículo removido' });
    invalidateEntidade('Veiculo');
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="p-5 h-fit">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Car className="w-4 h-4 text-primary" /> {editingId ? 'Editar Veículo' : 'Novo Veículo'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Placa *</Label>
              <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} className="font-mono uppercase" placeholder="ABC1D23" required />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Scania R450" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} placeholder="Branco" />
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} placeholder="2022" />
            </div>
            <div className="space-y-1.5">
              <Label>Tara (kg)</Label>
              <Input type="number" value={form.tara} onChange={(e) => setForm({ ...form, tara: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Capacidade (kg)</Label>
            <Input type="number" value={form.capacidade_kg} onChange={(e) => setForm({ ...form, capacidade_kg: e.target.value })} placeholder="Carga útil máxima" />
          </div>
          <div className="space-y-1.5">
            <Label>Transportadora</Label>
            <SearchSelect
              value={form.transportadora_id}
              onChange={(v) => setForm({ ...form, transportadora_id: v || '' })}
              options={transportadoras.map((t) => ({ value: t.id, label: t.nome }))}
              placeholder="Vincular transportadora"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Motorista</Label>
            <SearchSelect
              value={form.motorista_id}
              onChange={(v) => setForm({ ...form, motorista_id: v || '' })}
              options={motoristas.map((m) => ({ value: m.id, label: m.nome }))}
              placeholder="Vincular motorista"
            />
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
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por placa, modelo, transportadora, motorista..." className="pl-9" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum veículo cadastrado.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto scrollbar-thin pr-1">
            {filtered.map((v) => (
              <Card key={v.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-medium">{v.placa}</p>
                      {v.modelo && <span className="text-sm text-muted-foreground">{v.modelo}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      {v.cor && <span>{v.cor}</span>}
                      {v.ano && <span>{v.ano}</span>}
                      {v.tara ? <span>Tara: {v.tara} kg</span> : null}
                      {v.capacidade_kg ? <span>Cap.: {v.capacidade_kg} kg</span> : null}
                      {nomeTransp(v.transportadora_id) && <span>Transp.: {nomeTransp(v.transportadora_id)}</span>}
                      {nomeMotorista(v.motorista_id) && <span>Motorista: {nomeMotorista(v.motorista_id)}</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(v)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}