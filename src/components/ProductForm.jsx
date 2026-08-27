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
import SearchSelect from '@/components/SearchSelect';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ProdutoFotoUpload from '@/components/cadastros/ProdutoFotoUpload';
import { setorControlaValidade } from '@/lib/lotes';
import { sortGavetas } from '@/lib/gavetas';
import { findProdutoDuplicado } from '@/lib/produtoDedup';
import { proximoCodigoInterno } from '@/lib/produtoCodigo';
import { formatQtd, parseQtd, formatInputQtd } from '@/lib/format';
import { UNIDADES, convertQty, isConversivel } from '@/lib/units';
import { entrarSaldo } from '@/lib/saldos';
import { relocarSaldoCadastro } from '@/lib/movimentacoes';
import { invalidateEntidade } from '@/lib/useEntidades';

const empty = {
  codigo: '',
  codigo_referencia: '',
  nome: '',
  setor_id: '',
  deposito_id: '',
  maquina_id: '',
  gaveta_id: '',
  quantidade: 0,
  unidade: 'un',
  unidade_alt: '',
  fator_conversao: 0,
  estoque_minimo: 0,
  venda: false,
  foto_url: '',
};

export default function ProductForm({ open, onOpenChange, produto, setores, depositos = [], maquinas, gavetas, onSaved, produtos = [] }) {
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
      const basePayload = {
        ...form,
        estoque_minimo: parseQtd(form.estoque_minimo),
        fator_conversao: form.fator_conversao ? parseQtd(form.fator_conversao) : 0,
      };
      if (produto) {
        const duplicado = findProdutoDuplicado({ produtos, dados: form, excludeId: produto.id });
        if (duplicado) {
          toast({ variant: 'destructive', title: 'Código já existe', description: `Já existe outro produto com este código: ${duplicado.nome}.` });
          return;
        }
        // EDIT: nunca zera a quantidade — ela é gerenciada pelos saldos/movimentações.
        await base44.entities.Produto.update(produto.id, { ...basePayload, quantidade: produto.quantidade });

        // O endereço físico do produto (depósito + gaveta) é a origem da verdade.
        // Move TODO o saldo existente para o endereço escolhido, não importa onde
        // o saldo esteja hoje (o SaldoEstoque é a fonte real, não produto.deposito_id).
        const newDep = form.deposito_id || '';
        const newGav = form.gaveta_id || '';
        if (newDep) {
          const res = await relocarSaldoCadastro({
            produto,
            newDepositoId: newDep,
            newGavetaId: newGav,
            controlaValidade,
            depositos,
          });
          invalidateEntidade('SaldoEstoque');
          invalidateEntidade('Movimentacao');
          invalidateEntidade('Produto');
          invalidateEntidade('Lote');
          if (res.movido) {
            toast({ title: 'Saldo realocado', description: `${formatQtd(res.quantidade)} ${form.unidade || ''} movido(s) para o novo endereço.` });
          }
        }
      } else {
        const duplicado = findProdutoDuplicado({ produtos, dados: form });
        if (duplicado) {
          toast({ variant: 'destructive', title: 'Código já existe', description: `Já existe um produto com este código: ${duplicado.nome}. Use Movimentações para dar entrada.` });
          return;
        }
        const created = await base44.entities.Produto.create({ ...basePayload, quantidade: 0, codigo: proximoCodigoInterno(produtos) });
        if (!controlaValidade && newQtd > 0 && form.deposito_id) {
          await entrarSaldo({ produto: created, depositoId: form.deposito_id, gavetaId: form.gaveta_id || '', quantidade: newQtd, unidade: form.unidade || 'un', saldos: [] });
          invalidateEntidade('SaldoEstoque');
          await base44.entities.Movimentacao.create({
            data: new Date().toISOString(),
            produto_id: created.id,
            codigo: created.codigo,
            nome_produto: form.nome,
            quantidade: newQtd,
            setor_id: form.setor_id,
            deposito_id: form.deposito_id,
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
              <Label>Código Interno</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                {produto?.codigo || 'Gerado automaticamente'}
              </div>
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

          <div className="space-y-2 rounded-lg border p-3">
            <Label>Foto de referência <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
            <ProdutoFotoUpload value={form.foto_url || ''} onChange={(url) => set('foto_url', url)} />
          </div>

          <div className="space-y-1.5">
            <Label>Setor *</Label>
            <SearchSelect
              value={form.setor_id}
              onChange={(v) => set('setor_id', v === 'all' ? '' : v)}
              allLabel="— Nenhum —"
              placeholder="Buscar setor..."
              options={setores.map((s) => ({ value: s.id, label: s.nome }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Depósito <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
            <SearchSelect
              value={form.deposito_id}
              onChange={(v) => set('deposito_id', v === 'all' ? '' : v)}
              allLabel="— Nenhum —"
              placeholder="Buscar depósito..."
              options={depositos.map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' · ' + d.nome : ''}` }))}
            />
            <p className="text-xs text-muted-foreground">Local físico. Pode ser de qualquer setor.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Máquina <span className="text-xs font-normal text-muted-foreground">(etiqueta opcional)</span></Label>
              <SearchSelect
                value={form.maquina_id}
                onChange={(v) => set('maquina_id', v === 'all' ? '' : v)}
                allLabel="— Nenhuma —"
                placeholder="Buscar máquina..."
                options={maquinas.map((m) => ({ value: m.id, label: `${m.codigo} — ${m.nome}` }))}
              />
              <p className="text-xs text-muted-foreground">Etiqueta de organização. Não define a localização física.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Gaveta <span className="text-xs font-normal text-muted-foreground">(endereço físico)</span></Label>
              <SearchSelect
                value={form.gaveta_id}
                onChange={(v) => set('gaveta_id', v === 'all' ? '' : v)}
                allLabel="— Nenhum —"
                placeholder="Buscar gaveta..."
                options={sortGavetas(gavetas).map((g) => ({ value: g.id, label: g.codigo }))}
              />
              <p className="text-xs text-muted-foreground">Endereço físico onde o produto fica guardado. Liberado quando o estoque zera.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="quantidade">Quantidade</Label>
              {produto ? (
                <>
                  <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground tabular-nums">
                    {formatQtd(produto.quantidade || 0)} {produto.unidade || ''}
                  </div>
                  <p className="text-xs text-amber-600">Gerenciada por saldos/movimentações</p>
                </>
              ) : (
                <>
                  <Input id="quantidade" type="text" inputMode="decimal" placeholder="0,00" value={controlaValidade ? 0 : form.quantidade} onChange={(e) => set('quantidade', e.target.value)} disabled={controlaValidade} />
                  {controlaValidade && <p className="text-xs text-amber-600">Gerenciada por lotes (Entradas e Saídas)</p>}
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unidade">Unidade</Label>
              <SearchSelect
                value={form.unidade || 'un'}
                onChange={handleUnidadeChange}
                placeholder="Buscar unidade..."
                options={UNIDADES.flatMap((f) => f.itens.map((u) => ({ value: u.value, label: u.label })))}
              />
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