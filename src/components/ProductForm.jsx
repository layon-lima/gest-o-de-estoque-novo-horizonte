import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { setorControlaValidade } from '@/lib/lotes';
import { sortGavetas } from '@/lib/gavetas';

const empty = {
  codigo: '',
  codigo_referencia: '',
  nome: '',
  setor_id: '',
  maquina_id: '',
  gaveta_id: '',
  quantidade: 0,
  unidade: 'un',
  estoque_minimo: 0,
};

export default function ProductForm({ open, onOpenChange, produto, setores, maquinas, gavetas, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (produto) setForm({ ...empty, ...produto });
    else setForm(empty);
  }, [produto, open]);

  const controlaValidade = setorControlaValidade(form.setor_id, setores);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const newQtd = controlaValidade ? 0 : Number(form.quantidade) || 0;
      const payload = { ...form, quantidade: newQtd, estoque_minimo: Number(form.estoque_minimo) || 0 };
      if (produto) {
        await base44.entities.Produto.update(produto.id, payload);
        if (!controlaValidade) {
          const oldQtd = Number(produto.quantidade) || 0;
          const diff = newQtd - oldQtd;
          if (diff !== 0) {
            await base44.entities.Movimentacao.create({
              data: new Date().toISOString(),
              produto_id: produto.id,
              codigo: form.codigo,
              nome_produto: form.nome,
              quantidade: Math.abs(diff),
              setor_id: form.setor_id,
              maquina_id: form.maquina_id,
              gaveta_id: form.gaveta_id,
              tipo: diff > 0 ? 'entrada' : 'saida',
              observacao: 'Ajuste via cadastro de produto',
            });
          }
        }
      } else {
        const created = await base44.entities.Produto.create(payload);
        if (!controlaValidade && newQtd > 0) {
          await base44.entities.Movimentacao.create({
            data: new Date().toISOString(),
            produto_id: created.id,
            codigo: form.codigo,
            nome_produto: form.nome,
            quantidade: newQtd,
            setor_id: form.setor_id,
            maquina_id: form.maquina_id,
            gaveta_id: form.gaveta_id,
            tipo: 'entrada',
            observacao: 'Cadastro inicial de produto',
          });
        }
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{produto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código Interno *</Label>
              <Input id="codigo" value={form.codigo} onChange={(e) => set('codigo', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codigo_referencia">Código de Referência</Label>
            <Input id="codigo_referencia" value={form.codigo_referencia || ''} onChange={(e) => set('codigo_referencia', e.target.value)} placeholder="Definido na entrada em estoque" />
          </div>

          <div className="space-y-1.5">
            <Label>Setor *</Label>
            <Select value={form.setor_id || 'none'} onValueChange={(v) => set('setor_id', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Máquina</Label>
              <Select value={form.maquina_id || 'none'} onValueChange={(v) => set('maquina_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {maquinas.map((m) => <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gaveta</Label>
              <Select value={form.gaveta_id || 'none'} onValueChange={(v) => set('gaveta_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {sortGavetas(gavetas).map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input id="quantidade" type="number" min="0" value={controlaValidade ? 0 : form.quantidade} onChange={(e) => set('quantidade', e.target.value)} disabled={controlaValidade} />
              {controlaValidade && <p className="text-xs text-amber-600">Gerenciada por lotes (Entradas e Saídas)</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unidade">Unidade</Label>
              <Input id="unidade" value={form.unidade} onChange={(e) => set('unidade', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Estoque mín.</Label>
              <Input id="min" type="number" min="0" value={form.estoque_minimo} onChange={(e) => set('estoque_minimo', e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}