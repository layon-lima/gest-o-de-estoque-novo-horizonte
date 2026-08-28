import { useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { registrarTransportadora } from '@/lib/portaria';

const empty = {
  nome: '',
  documento: '',
  ie: '',
  telefone: '',
  cidade: '',
  uf: '',
  endereco: '',
  observacao: '',
};

export default function PortariaTransportadoraForm({ onSaved }) {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: 'Informe o nome da transportadora', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await registrarTransportadora(form);
      toast({
        title: res.action === 'criado' ? 'Transportadora cadastrada' : 'Transportadora já cadastrada',
        description: `${res.record.nome}${res.action === 'reutilizado' ? ' — reutilizada' : ''}`,
        variant: res.action === 'criado' ? 'default' : 'secondary',
      });
      setForm(empty);
      onSaved?.();
    } catch (err) {
      toast({ title: 'Erro ao cadastrar transportadora', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Nome / Razão Social *</Label>
        <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome da transportadora" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>CNPJ</Label>
          <Input value={form.documento} onChange={(e) => set('documento', e.target.value)} placeholder="00.000.000/0000-00" />
        </div>
        <div className="space-y-1.5">
          <Label>Inscrição Estadual</Label>
          <Input value={form.ie} onChange={(e) => set('ie', e.target.value)} placeholder="IE" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 0000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label>UF</Label>
          <Input
            value={form.uf}
            onChange={(e) => set('uf', e.target.value.toUpperCase().slice(0, 2))}
            placeholder="SP"
            maxLength={2}
            className="uppercase"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Endereço</Label>
        <Input value={form.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, nº, bairro" />
      </div>
      <div className="space-y-1.5">
        <Label>Cidade</Label>
        <Input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} placeholder="Cidade" />
      </div>
      <div className="space-y-1.5">
        <Label>Observação</Label>
        <Textarea value={form.observacao} onChange={(e) => set('observacao', e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
        Cadastrar Transportadora
      </Button>
    </form>
  );
}