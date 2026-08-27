import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import SearchSelect from '@/components/SearchSelect';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import { findSetorCombustivel, produtosCombustivel } from '@/lib/abastecimento';
import SearchInput from './SearchInput';
import { nextMaquinaCodigo } from '@/lib/maquinas';

const emptyForm = { codigo: '', nome: '', descricao: '', deposito_id: '', permite_abastecimento: false, combustivel_id: '', combustivel_nome: '' };

export default function MaquinaManager() {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const { data } = useEntidades({ Maquina: {}, Deposito: {}, Produto: {}, Setor: {} });
  const items = data.Maquina || [];
  const depositos = data.Deposito || [];
  const produtos = data.Produto || [];
  const setores = data.Setor || [];
  const combustiveis = useMemo(
    () => produtosCombustivel(produtos, findSetorCombustivel(setores)?.id),
    [produtos, setores]
  );
  const loading = false;

  const depositoLabel = (id) => {
    const d = depositos.find((x) => x.id === id);
    return d ? (d.nome ? `${d.numero} · ${d.nome}` : d.numero) : null;
  };

  const combustivelLabel = (id) => {
    const c = combustiveis.find((x) => x.id === id);
    return c ? c.nome : null;
  };

  const filteredItems = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return items;
    return items.filter((m) =>
      (m.codigo || '').toLowerCase().includes(q) ||
      (m.nome || '').toLowerCase().includes(q) ||
      (m.descricao || '').toLowerCase().includes(q)
    );
  }, [items, busca]);

  async function handleSubmit(e) {
    e.preventDefault();
    const combustivel = combustiveis.find((c) => c.id === form.combustivel_id) || null;
    const combustivelPayload = form.permite_abastecimento
      ? { combustivel_id: combustivel?.id || '', combustivel_nome: combustivel?.nome || '' }
      : { combustivel_id: '', combustivel_nome: '' };

    let salva;
    if (editingId) {
      salva = await base44.entities.Maquina.update(editingId, {
        nome: form.nome,
        descricao: form.descricao,
        deposito_id: form.deposito_id,
        permite_abastecimento: form.permite_abastecimento,
        ...combustivelPayload,
      });
      salva = { ...form, id: editingId, ...salva };
    } else {
      const codigo = nextMaquinaCodigo(items);
      salva = await base44.entities.Maquina.create({ ...form, codigo, ...combustivelPayload });
      toast({ title: 'Máquina cadastrada', description: `Código gerado: ${codigo}` });
    }
    setForm(emptyForm);
    setEditingId(null);
    invalidateEntidade('Maquina');
  }

  async function handleDelete(id) {
    await base44.entities.Maquina.delete(id);
    invalidateEntidade('Maquina');
  }

  function handleEdit(item) {
    setForm({
      codigo: item.codigo,
      nome: item.nome,
      descricao: item.descricao || '',
      deposito_id: item.deposito_id || '',
      permite_abastecimento: item.permite_abastecimento === true,
      combustivel_id: item.combustivel_id || '',
      combustivel_nome: item.combustivel_nome || '',
    });
    setEditingId(item.id);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-4">{editingId ? 'Editar Máquina' : 'Nova Máquina'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-cod">Código {editingId ? '(gerado)' : '(automático)'}</Label>
            <Input
              id="m-cod"
              readOnly
              value={editingId ? form.codigo : nextMaquinaCodigo(items)}
              className="bg-muted/50 font-mono cursor-not-allowed"
              placeholder="Será gerado ao salvar"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-nome">Nome / Descrição *</Label>
            <Input id="m-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Descrição</Label>
            <Input id="m-desc" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Depósito <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
            <SearchSelect
              value={form.deposito_id}
              onChange={(v) => setForm({ ...form, deposito_id: v === 'all' ? '' : v })}
              allLabel="— Nenhum —"
              placeholder="Buscar depósito..."
              options={depositos.map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' · ' + d.nome : ''}` }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="m-abast" className="cursor-pointer">Permite abastecimento</Label>
              <p className="text-xs text-muted-foreground">Marcada, a máquina aparece na tela de Abastecimento e o QR Code libera o registro de combustível.</p>
            </div>
            <Switch id="m-abast" checked={form.permite_abastecimento} onCheckedChange={(v) => setForm({ ...form, permite_abastecimento: v })} />
          </div>
          {form.permite_abastecimento && (
            <div className="space-y-1.5">
              <Label>Combustível <span className="text-xs font-normal text-muted-foreground">(predefinido)</span></Label>
              <SearchSelect
                value={form.combustivel_id}
                onChange={(v) => setForm({ ...form, combustivel_id: v === 'all' ? '' : v })}
                allLabel="— Nenhum —"
                placeholder="Buscar combustível..."
                options={combustiveis.map((c) => ({ value: c.id, label: c.nome }))}
              />
              <p className="text-xs text-muted-foreground">Definido, o combustível é selecionado automaticamente ao abastecer esta máquina.</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</Button>}
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
                  {item.permite_abastecimento === true && combustivelLabel(item.combustivel_id) && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300"><Fuel className="w-3 h-3 mr-1" />{combustivelLabel(item.combustivel_id)}</Badge>
                  )}
                  {depositoLabel(item.deposito_id) && (
                    <Badge variant="outline" className="font-mono">{depositoLabel(item.deposito_id)}</Badge>
                  )}
                </div>
                {item.descricao && <p className="text-sm text-muted-foreground truncate mt-0.5">{item.descricao}</p>}
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