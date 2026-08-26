import { useState, useMemo } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatQtd, parseQtd } from '@/lib/format';
import { sortGavetas } from '@/lib/gavetas';
import { registrarTransferencia } from '@/lib/movimentacoes';
import { setorControlaValidade } from '@/lib/lotes';
import ProductSearchSelect from '@/components/ProductSearchSelect';

const emptyForm = {
  produto_id: '',
  deposito_origem_id: '',
  gaveta_origem_id: '',
  deposito_destino_id: '',
  gaveta_destino_id: '',
  quantidade: '',
  observacao: '',
};

export default function TransferenciaDepositoDialog({ open, onOpenChange, produtos, depositos, gavetas, setores, lotes, saldos, movimentacoes, onDone }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const produto = produtos.find((p) => p.id === form.produto_id);
  const controlaValidade = produto ? setorControlaValidade(produto.setor_id, setores) : false;

  // Depósitos que têm saldo do produto selecionado (para o seletor de origem)
  const depositosComSaldo = useMemo(() => {
    if (!produto) return [];
    const depIds = new Set(
      (saldos || [])
        .filter((s) => s.produto_id === produto.id && (s.quantidade || 0) > 0)
        .map((s) => s.deposito_id)
        .filter(Boolean)
    );
    return (depositos || []).filter((d) => depIds.has(d.id));
  }, [produto, saldos, depositos]);

  // Saldo disponível na origem selecionada
  const saldoOrigem = useMemo(() => {
    if (!produto || !form.deposito_origem_id) return 0;
    return (saldos || [])
      .filter(
        (s) =>
          s.produto_id === produto.id &&
          s.deposito_id === form.deposito_origem_id &&
          (!form.gaveta_origem_id || (s.gaveta_id || '') === form.gaveta_origem_id)
      )
      .reduce((sum, s) => sum + (s.quantidade || 0), 0);
  }, [produto, form.deposito_origem_id, form.gaveta_origem_id, saldos]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleProdutoChange(id) {
    setForm({ ...emptyForm, produto_id: id });
  }

  function handleClose(open) {
    if (!open) {
      setForm(emptyForm);
    }
    onOpenChange(open);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!produto) return;
    setSaving(true);
    try {
      await registrarTransferencia({
        form,
        produto,
        lotes,
        saldos,
        movimentacoes,
        controlaValidade,
        depositos,
      });
      toast({
        title: 'Transferência realizada',
        description: `${formatQtd(parseQtd(form.quantidade))} ${produto.unidade || 'un'} de ${produto.nome} transferidos.`,
      });
      setForm(emptyForm);
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('SALDO_INSUFICIENTE')) {
        const disp = Number(msg.split(':')[1] || 0);
        toast({ variant: 'destructive', title: 'Saldo insuficiente', description: `Disponível na origem: ${formatQtd(disp)} ${produto.unidade || 'un'}.` });
      } else if (msg.startsWith('DEPOSITO_OBRIGATORIO')) {
        toast({ variant: 'destructive', title: 'Depósito obrigatório', description: 'Selecione os depósitos de origem e destino.' });
      } else if (msg.startsWith('ORIGEM_DESTINO_IGUAIS')) {
        toast({ variant: 'destructive', title: 'Origem e destino iguais', description: 'Selecione depósitos ou gavetas diferentes.' });
      } else if (msg === 'Quantidade inválida.') {
        toast({ variant: 'destructive', title: 'Quantidade inválida', description: 'Informe uma quantidade maior que zero.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao transferir', description: msg });
      }
    } finally {
      setSaving(false);
    }
  }

  const gavetasOrigem = sortGavetas(gavetas.filter((g) => g.deposito_id === form.deposito_origem_id));
  const gavetasDestino = sortGavetas(gavetas.filter((g) => g.deposito_id === form.deposito_destino_id));
  const isOrigemIgualDestino = form.deposito_origem_id && form.deposito_origem_id === form.deposito_destino_id && (form.gaveta_origem_id || '') === (form.gaveta_destino_id || '');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferência entre Depósitos
          </DialogTitle>
          <DialogDescription>
            Move o produto internamente de um depósito para outro, preservando lotes e auditando via movimentações de saída e entrada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Produto */}
          <div className="space-y-1.5">
            <Label>Produto *</Label>
            <ProductSearchSelect
              produtos={produtos}
              maquinas={[]}
              gavetas={gavetas}
              value={form.produto_id}
              onChange={handleProdutoChange}
              placeholder="Buscar produto por nome, código, referência…"
            />
            {produto && (
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="text-muted-foreground">Estoque total:</span>
                <span className="font-semibold tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                  {formatQtd(produto.quantidade || 0)} {produto.unidade || ''}
                </span>
              </div>
            )}
          </div>

          {/* Origem */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-red-50/60 border border-red-200">
            <div className="col-span-2">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Origem (de onde sai)</span>
            </div>
            <div className="space-y-1.5">
              <Label>Depósito de Origem *</Label>
              <Select
                value={form.deposito_origem_id || 'none'}
                onValueChange={(v) => set('deposito_origem_id', v === 'none' ? '' : v)}
                disabled={!produto}
              >
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {depositosComSaldo.length === 0 ? (
                    <SelectItem value="none" disabled>— Sem saldo —</SelectItem>
                  ) : (
                    depositosComSaldo.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.numero}{d.nome ? ` · ${d.nome}` : ''}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gaveta de Origem <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Select
                value={form.gaveta_origem_id || 'none'}
                onValueChange={(v) => set('gaveta_origem_id', v === 'none' ? '' : v)}
                disabled={!form.deposito_origem_id}
              >
                <SelectTrigger><SelectValue placeholder="Endereço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Todas —</SelectItem>
                  {gavetasOrigem.map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.deposito_origem_id && (
              <div className="col-span-2 text-xs">
                <span className="text-muted-foreground">Saldo disponível na origem: </span>
                <span className="font-semibold tabular-nums">{formatQtd(saldoOrigem)} {produto?.unidade || ''}</span>
              </div>
            )}
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label htmlFor="trf-qtd">Quantidade a Transferir *</Label>
            <Input
              id="trf-qtd"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.quantidade}
              onChange={(e) => set('quantidade', e.target.value)}
              required
              disabled={!produto}
            />
            {saldoOrigem > 0 && parseQtd(form.quantidade) > saldoOrigem && (
              <p className="text-xs text-destructive">Quantidade excede o saldo disponível ({formatQtd(saldoOrigem)} {produto?.unidade || ''}).</p>
            )}
          </div>

          {/* Destino */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-green-50/60 border border-green-200">
            <div className="col-span-2">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Destino (para onde vai)</span>
            </div>
            <div className="space-y-1.5">
              <Label>Depósito de Destino *</Label>
              <Select
                value={form.deposito_destino_id || 'none'}
                onValueChange={(v) => set('deposito_destino_id', v === 'none' ? '' : v)}
                disabled={!produto}
              >
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>— Selecione —</SelectItem>
                  {(depositos || []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.numero}{d.nome ? ` · ${d.nome}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gaveta de Destino <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Select
                value={form.gaveta_destino_id || 'none'}
                onValueChange={(v) => set('gaveta_destino_id', v === 'none' ? '' : v)}
                disabled={!form.deposito_destino_id}
              >
                <SelectTrigger><SelectValue placeholder="Endereço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {gavetasDestino.map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isOrigemIgualDestino && (
              <p className="col-span-2 text-xs text-destructive">Origem e destino são iguais. Selecione locais diferentes.</p>
            )}
            {controlaValidade && (
              <p className="col-span-2 text-xs text-blue-700 flex items-start gap-1.5">
                <span>📦 Setor controla validade: os lotes serão consumidos por FEFO na origem e recriados no destino automaticamente.</span>
              </p>
            )}
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <Label htmlFor="trf-obs">Observação</Label>
            <Textarea
              id="trf-obs"
              rows={2}
              value={form.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              placeholder="Motivo da transferência (opcional)…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.produto_id || !form.deposito_origem_id || !form.deposito_destino_id || isOrigemIgualDestino || !form.quantidade}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              {saving ? 'Transferindo…' : 'Transferir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}