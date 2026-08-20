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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { setorControlaValidade } from '@/lib/lotes';
import { sortGavetas } from '@/lib/gavetas';
import { findProdutoDuplicado } from '@/lib/produtoDedup';
import { formatQtd, parseQtd, formatInputQtd } from '@/lib/format';
import { UNIDADES, convertQty, isConversivel } from '@/lib/units';

const empty = {
  codigo: '',
  codigo_referencia: '',
  nome: '',
  setor_id: '',
  maquina_id: '',
  gaveta_id: '',
  quantidade: 0,
  unidade: 'un',
  unidade_alt: '',
  fator_conversao: 0,
  estoque_minimo: 0,
  venda: false,
};

export default function ProductForm({ open, onOpenChange, produto, setores, maquinas, gavetas, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (produto) setForm({ ...empty, ...produto });
    else setForm(empty);
  }, [produto, open]);

  const controlaValidade = setorControlaValidade(form.setor_id, setores);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  function handleUnidadeChange(novaUnidade) {
    const unidadeAtual = form.unidade || 'un';
    if (controlaValidade) {
      set('unidade', novaUnidade);
      return;
    }
    const qtdAtual = parseQtd(form.quantidade);
    const minAtual = parseQtd(form.estoque_minimo);
    if (!isConversivel(unidadeAtual, novaUnidade)) {
      set('unidade', novaUnidade);
      return;
    }
    const novaQtd = convertQty(qtdAtual, unidadeAtual, novaUnidade);
    const novoMin = convertQty(minAtual, unidadeAtual, novaUnidade);
    setForm((f) => ({
      ...f,
      unidade: novaUnidade,
      quantidade: formatInputQtd(novaQtd),
      estoque_minimo: formatInputQtd(novoMin),
    }));
    toast({
      title: 'Unidade convertida',
      description: `${formatQtd(qtdAtual)} ${unidadeAtual} → ${formatQtd(novaQtd)} ${novaUnidade}.`,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const newQtd = controlaValidade ? 0 : parseQtd(form.quantidade);
      const payload = { ...form, quantidade: newQtd, estoque_minimo: parseQtd(form.estoque_minimo), fator_conversao: form.fator_conversao ? parseQtd(form.fator_conversao) : 0 };
      if (produto) {
        const payloadFinal = newQtd <= 0 ? { ...payload, gaveta_id: '' } : payload;
        await base44.entities.Produto.update(produto.id, payloadFinal);
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
              gaveta_id: newQtd <= 0 ? '' : form.gaveta_id,
              tipo: diff > 0 ? 'entrada' : 'saida',
              observacao: 'Ajuste via cadastro de produto',
            });
          }
        }
      } else {
        const allProdutos = await base44.entities.Produto.list();
        const duplicado = findProdutoDuplicado({ produtos: allProdutos, dados: form });
        if (duplicado) {
          if (controlaValidade) {
            toast({
              title: 'Produto já existe',
              description: 'Já existe um produto com este código e referência. Use Movimentações para registrar entradas de lote.',
              variant: 'destructive',
            });
            return;
          }
          const novaQtd = (Number(duplicado.quantidade) || 0) + newQtd;
          await base44.entities.Produto.update(duplicado.id, {
            quantidade: novaQtd,
            maquina_id: form.maquina_id || duplicado.maquina_id,
            gaveta_id: form.gaveta_id || duplicado.gaveta_id,
          });
          if (newQtd > 0) {
            await base44.entities.Movimentacao.create({
              data: new Date().toISOString(),
              produto_id: duplicado.id,
              codigo: duplicado.codigo,
              nome_produto: duplicado.nome,
              quantidade: newQtd,
              setor_id: duplicado.setor_id,
              maquina_id: form.maquina_id || duplicado.maquina_id,
              gaveta_id: form.gaveta_id || duplicado.gaveta_id,
              tipo: 'entrada',
              observacao: 'Entrada via cadastro (produto existente)',
            });
          }
          toast({
            title: 'Quantidade somada ao produto existente',
            description: `${duplicado.nome} — adicionadas ${formatQtd(newQtd)} ${form.unidade || 'un'}.`,
          });
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
              <Label>Máquina <span className="text-xs font-normal text-muted-foreground">(etiqueta opcional)</span></Label>
              <Select value={form.maquina_id || 'none'} onValueChange={(v) => set('maquina_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {maquinas.map((m) => <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Etiqueta de organização. Não define a localização física.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Gaveta <span className="text-xs font-normal text-muted-foreground">(endereço físico)</span></Label>
              <Select value={form.gaveta_id || 'none'} onValueChange={(v) => set('gaveta_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o endereço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {sortGavetas(gavetas).map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Endereço físico onde o produto fica guardado. Liberado quando o estoque zera.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input id="quantidade" type="text" inputMode="decimal" placeholder="0,00" value={controlaValidade ? 0 : form.quantidade} onChange={(e) => set('quantidade', e.target.value)} disabled={controlaValidade} />
              {controlaValidade && <p className="text-xs text-amber-600">Gerenciada por lotes (Entradas e Saídas)</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unidade">Unidade</Label>
              <Select value={form.unidade || 'un'} onValueChange={handleUnidadeChange}>
                <SelectTrigger id="unidade"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((fam, fi) => (
                    <SelectGroup key={fam.familia}>
                      {fi > 0 && <SelectSeparator />}
                      <SelectLabel>{fam.familia}</SelectLabel>
                      {fam.itens.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Estoque mín.</Label>
              <Input id="min" type="text" inputMode="decimal" placeholder="0,00" value={form.estoque_minimo} onChange={(e) => set('estoque_minimo', e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!form.venda} onCheckedChange={(v) => set('venda', !!v)} />
            <span className="text-sm">Produto de venda <span className="text-xs text-muted-foreground">(comercializado na pesagem/balança)</span></span>
          </label>

          <div className="space-y-1.5 rounded-lg border border-dashed p-3">
            <Label>Conversão customizada (opcional)</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs whitespace-nowrap">1</span>
              <Input className="h-8 w-24" placeholder="CX" value={form.unidade_alt || ''} onChange={(e) => set('unidade_alt', e.target.value)} />
              <span className="text-xs whitespace-nowrap">=</span>
              <Input type="text" inputMode="decimal" className="h-8 w-24" placeholder="0,00" value={form.fator_conversao || ''} onChange={(e) => set('fator_conversao', e.target.value)} />
              <span className="text-xs whitespace-nowrap">{form.unidade || 'un'}</span>
            </div>
            <p className="text-xs text-muted-foreground">Para unidades de NF-e não reconhecidas automaticamente (ex.: CX, GAL, FR). Quando a NF-e trouxer esta unidade, a quantidade será multiplicada pelo fator.</p>
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