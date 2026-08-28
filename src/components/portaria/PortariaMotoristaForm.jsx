import { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { registrarMotorista } from '@/lib/portaria';

const empty = {
  nome: '',
  documento: '',
  telefone: '',
  cidade: '',
  uf: '',
  endereco: '',
  cnh: '',
  cnh_validade: '',
  observacao: '',
};

export default function PortariaMotoristaForm({ onSaved }) {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: 'Informe o nome do motorista', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await registrarMotorista(form);
      toast({
        title: res.action === 'criado' ? 'Motorista cadastrado' : 'Motorista já cadastrado',
        description: `${res.record.nome}${res.action === 'reutilizado' ? ' — reutilizado' : ''}`,
        variant: res.action === 'criado' ? 'default' : 'secondary',
      });
      setForm(empty);
      onSaved?.();
    } catch (err) {
      toast({ title: 'Erro ao cadastrar motorista', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Nome *</Label>
        <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome do motorista" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>CPF</Label>
          <Input value={form.documento} onChange={(e) => set('documento', e.target.value)} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>CNH</Label>
          <Input value={form.cnh} onChange={(e) => set('cnh', e.target.value)} placeholder="Nº da CNH" />
        </div>
        <div className="space-y-1.5">
          <Label>Validade da CNH</Label>
          <Input type="date" value={form.cnh_validade} onChange={(e) => set('cnh_validade', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Endereço</Label>
        <Input value={form.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, nº, bairro" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <Input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} placeholder="Cidade" />
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
        <Label>Observação</Label>
        <Textarea value={form.observacao} onChange={(e) => set('observacao', e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        Cadastrar Motorista
      </Button>
    </form>
  );
}