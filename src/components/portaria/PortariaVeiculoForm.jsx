import { useState, useEffect } from 'react';
import { Car, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import SearchSelect from '@/components/SearchSelect';
import { registrarVeiculo, loadMotoristas, loadTransportadoras } from '@/lib/portaria';

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

export default function PortariaVeiculoForm({ onSaved }) {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [motoristas, setMotoristas] = useState([]);
  const [transportadoras, setTransportadoras] = useState([]);
  const { toast } = useToast();

  const reload = () => {
    loadMotoristas().then(setMotoristas).catch(() => setMotoristas([]));
    loadTransportadoras().then(setTransportadoras).catch(() => setTransportadoras([]));
  };

  useEffect(() => {
    reload();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.placa.trim()) {
      toast({ title: 'Informe a placa do veículo', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await registrarVeiculo(form);
      toast({
        title: res.action === 'criado' ? 'Veículo cadastrado' : 'Veículo já cadastrado',
        description: `${res.record.placa}${res.action === 'reutilizado' ? ' — reutilizado' : ''}`,
        variant: res.action === 'criado' ? 'default' : 'secondary',
      });
      setForm(empty);
      reload();
      onSaved?.();
    } catch (err) {
      toast({ title: 'Erro ao cadastrar veículo', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const motoristaOpts = motoristas.map((m) => ({ value: m.id, label: m.nome }));
  const transpOpts = transportadoras.map((t) => ({ value: t.id, label: t.nome }));

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Placa *</Label>
          <Input
            value={form.placa}
            onChange={(e) => set('placa', e.target.value.toUpperCase())}
            placeholder="ABC1D23"
            className="font-mono uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Modelo</Label>
          <Input value={form.modelo} onChange={(e) => set('modelo', e.target.value)} placeholder="Scania R450" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Cor</Label>
          <Input value={form.cor} onChange={(e) => set('cor', e.target.value)} placeholder="Branco" />
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Input value={form.ano} onChange={(e) => set('ano', e.target.value)} placeholder="2022" />
        </div>
        <div className="space-y-1.5">
          <Label>Tara (kg)</Label>
          <Input type="number" value={form.tara} onChange={(e) => set('tara', e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Capacidade (kg)</Label>
        <Input type="number" value={form.capacidade_kg} onChange={(e) => set('capacidade_kg', e.target.value)} placeholder="Carga útil máxima" />
      </div>
      <div className="space-y-1.5">
        <Label>Transportadora</Label>
        <SearchSelect
          value={form.transportadora_id}
          onChange={(v) => set('transportadora_id', v || '')}
          options={transpOpts}
          placeholder="Vincular transportadora"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Motorista</Label>
        <SearchSelect
          value={form.motorista_id}
          onChange={(v) => set('motorista_id', v || '')}
          options={motoristaOpts}
          placeholder="Vincular motorista"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Observação</Label>
        <Textarea value={form.observacao} onChange={(e) => set('observacao', e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
        Cadastrar Veículo
      </Button>
    </form>
  );
}