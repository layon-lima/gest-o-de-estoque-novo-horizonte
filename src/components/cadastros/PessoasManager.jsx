import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, User, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import TransportadoraManager from '@/components/cadastros/TransportadoraManager';

const empty = { nome: '', documento: '', telefone: '', cidade: '', is_cliente: true, is_fornecedor: false, observacao: '' };

export default function PessoasManager() {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('all');
  const [modo, setModo] = useState('pessoas');
  const { toast } = useToast();

  const { data } = useEntidades({ Pessoa: { sort: '-created_date', limit: 500 } });
  const pessoas = data.Pessoa || [];

  const filtered = pessoas.filter((p) => {
    const q = busca.toLowerCase().trim();
    const matchBusca = !q || [p.nome, p.documento, p.cidade, p.telefone].filter(Boolean).join(' ').toLowerCase().includes(q);
    const matchFiltro =
      filtro === 'all' ||
      (filtro === 'cliente' && p.is_cliente) ||
      (filtro === 'fornecedor' && p.is_fornecedor);
    return matchBusca && matchFiltro;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }
    if (editingId) {
      await base44.entities.Pessoa.update(editingId, form);
      toast({ title: 'Cadastro atualizado' });
    } else {
      await base44.entities.Pessoa.create(form);
      toast({ title: 'Pessoa cadastrada' });
    }
    setForm(empty);
    setEditingId(null);
    invalidateEntidade('Pessoa');
  }

  function handleEdit(p) {
    setForm({
      nome: p.nome || '',
      documento: p.documento || '',
      telefone: p.telefone || '',
      cidade: p.cidade || '',
      is_cliente: !!p.is_cliente,
      is_fornecedor: !!p.is_fornecedor,
      observacao: p.observacao || '',
    });
    setEditingId(p.id);
  }

  async function handleDelete(id) {
    await base44.entities.Pessoa.delete(id);
    toast({ title: 'Pessoa removida' });
    invalidateEntidade('Pessoa');
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border overflow-hidden w-fit">
        {[
          { v: 'pessoas', l: 'Clientes / Fornecedores' },
          { v: 'transportadoras', l: 'Transportadoras' },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setModo(opt.v)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${modo === opt.v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
          >
            {opt.l}
          </button>
        ))}
      </div>
      {modo === 'transportadoras' ? (
        <TransportadoraManager />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-5 h-fit">
            <h3 className="font-semibold mb-4">{editingId ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome / Razão Social *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ / CPF</Label>
                <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.is_cliente} onCheckedChange={(v) => setForm({ ...form, is_cliente: !!v })} />
                  <span className="text-sm flex items-center gap-1"><User className="w-3.5 h-3.5" /> Cliente</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.is_fornecedor} onCheckedChange={(v) => setForm({ ...form, is_fornecedor: !!v })} />
                  <span className="text-sm flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Fornecedor</span>
                </label>
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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, documento, cidade..." className="pl-9" />
              </div>
              <div className="flex rounded-lg border overflow-hidden shrink-0">
                {[
                  { v: 'all', l: 'Todos' },
                  { v: 'cliente', l: 'Clientes' },
                  { v: 'fornecedor', l: 'Fornec.' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setFiltro(opt.v)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${filtro === opt.v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro encontrado.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto scrollbar-thin pr-1">
                {filtered.map((p) => (
                  <Card key={p.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{p.nome}</p>
                          {p.is_cliente && <Badge className="bg-blue-500 hover:bg-blue-500 text-[10px]"><User className="w-3 h-3 mr-0.5" /> Cliente</Badge>}
                          {p.is_fornecedor && <Badge className="bg-amber-600 hover:bg-amber-600 text-[10px]"><Truck className="w-3 h-3 mr-0.5" /> Fornecedor</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          {p.documento && <span className="font-mono">{p.documento}</span>}
                          {p.cidade && <span>{p.cidade}</span>}
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
      )}
    </div>
  );
}