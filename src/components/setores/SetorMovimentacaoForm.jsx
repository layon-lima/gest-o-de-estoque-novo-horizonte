import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ProductSearchSelect from '@/components/ProductSearchSelect';
import FornecedorCombobox from '@/components/FornecedorCombobox';
import { useToast } from '@/components/ui/use-toast';
import { formatQtd } from '@/lib/format';
import { registrarMovimentacao } from '@/lib/movimentacoes';
import { sortGavetas } from '@/lib/gavetas';

const emptyForm = {
  produto_id: '',
  tipo: 'entrada',
  quantidade: 1,
  deposito_id: '',
  gaveta_id: '',
  observacao: '',
  data_validade: '',
  numero_nf: '',
  fornecedor: '',
  chave_acesso: '',
};

export default function SetorMovimentacaoForm({ setor, produtos, maquinas, gavetas, depositos = [], lotes, saldos = [], movimentacoes, pessoas, onSaved, onClose, tipoForcado }) {
  const [form, setForm] = useState(() => (tipoForcado ? { ...emptyForm, tipo: tipoForcado } : emptyForm));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const produtosSetor = useMemo(() => produtos.filter((p) => p.setor_id === setor.id), [produtos, setor.id]);
  const produtoSelecionado = produtos.find((p) => p.id === form.produto_id);
  const controlaValidade = !!setor.controla_validade;

  const fornecedores = useMemo(() => {
    const nomes = new Set();
    pessoas.filter((p) => p.is_fornecedor).forEach((p) => p.nome && nomes.add(p.nome));
    movimentacoes.forEach((m) => { if (m.fornecedor) nomes.add(m.fornecedor); });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b));
  }, [pessoas, movimentacoes]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!produtoSelecionado) return;
    setSaving(true);
    try {
      await registrarMovimentacao({ form, produto: produtoSelecionado, lotes, saldos, movimentacoes, controlaValidade });
      toast({ title: 'Movimentação registrada com sucesso' });
      setForm(tipoForcado ? { ...emptyForm, tipo: tipoForcado } : emptyForm);
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('NF_DUPLICADA')) {
        toast({ variant: 'destructive', title: 'Nota fiscal duplicada', description: 'Esta NF-e já está ativa no estoque.' });
      } else if (msg.startsWith('VALIDADE_OBRIGATORIA')) {
        toast({ variant: 'destructive', title: 'Validade obrigatória', description: 'Este setor controla validade. Informe a data de validade.' });
      } else if (msg.startsWith('SALDO_INSUFICIENTE')) {
        const disp = Number(msg.split(':')[1] || 0);
        toast({ variant: 'destructive', title: 'Saldo insuficiente', description: `Disponível: ${formatQtd(disp)}.` });
      } else if (msg.startsWith('DEPOSITO_OBRIGATORIO')) {
        toast({ variant: 'destructive', title: 'Depósito obrigatório', description: 'Selecione o depósito onde o estoque será movimentado.' });
      } else if (msg === 'Quantidade inválida.') {
        toast({ variant: 'destructive', title: 'Quantidade inválida', description: 'Informe uma quantidade maior que zero.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao registrar', description: msg });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 text-sm">Nova Movimentação</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Produto *</Label>
          <ProductSearchSelect
            produtos={produtosSetor}
            maquinas={maquinas}
            gavetas={gavetas}
            value={form.produto_id}
            onChange={(v) => setForm({ ...form, produto_id: v })}
            placeholder="Buscar produto do setor…"
          />
          {produtoSelecionado && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Estoque atual:</span>
              <span className="font-semibold tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                {formatQtd(produtoSelecionado.quantidade || 0)} {produtoSelecionado.unidade || ''}
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!tipoForcado && (
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={tipoForcado ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
            <Label htmlFor="sf-qtd">Quantidade *</Label>
            <Input id="sf-qtd" type="text" inputMode="decimal" placeholder="0,00" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Depósito *</Label>
            <Select value={form.deposito_id || 'none'} onValueChange={(v) => setForm({ ...form, deposito_id: v === 'none' ? '' : v, gaveta_id: '' })}>
              <SelectTrigger><SelectValue placeholder="Onde?" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {depositos.map((d) => <SelectItem key={d.id} value={d.id}>{d.numero}{d.nome ? ` · ${d.nome}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Gaveta <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
            <Select value={form.gaveta_id || 'none'} onValueChange={(v) => setForm({ ...form, gaveta_id: v === 'none' ? '' : v })} disabled={!form.deposito_id}>
              <SelectTrigger><SelectValue placeholder="Endereço" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {sortGavetas(gavetas.filter((g) => !form.deposito_id || g.deposito_id === form.deposito_id)).map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {controlaValidade && form.tipo === 'entrada' && (
          <div className="space-y-1.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Label htmlFor="sf-val">Validade *</Label>
            <Input id="sf-val" type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} required />
            <p className="text-[10px] text-amber-700">Lote interno gerado automaticamente.</p>
          </div>
        )}
        {form.tipo === 'entrada' && (
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sf-nf">Número da NF</Label>
                <Input id="sf-nf" value={form.numero_nf} onChange={(e) => setForm({ ...form, numero_nf: e.target.value })} placeholder="000123456" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sf-forn">Fornecedor</Label>
                <FornecedorCombobox id="sf-forn" value={form.fornecedor} onChange={(v) => setForm({ ...form, fornecedor: v })} suggestions={fornecedores} placeholder="Nome / CNPJ" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sf-chave">Chave de acesso da NF-e</Label>
              <Input id="sf-chave" value={form.chave_acesso} onChange={(e) => setForm({ ...form, chave_acesso: e.target.value })} placeholder="44 dígitos" className="font-mono text-xs" />
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="sf-obs">Observação</Label>
          <Textarea id="sf-obs" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        </div>
        <Button type="submit" className="w-full" disabled={saving || !form.produto_id}>
          <Plus className="w-4 h-4 mr-2" />
          {saving ? 'Registrando…' : 'Registrar Movimentação'}
        </Button>
      </form>
    </Card>
  );
}