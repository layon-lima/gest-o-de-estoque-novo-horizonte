import { useState, useEffect } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Undo2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { getNome } from '@/lib/estoqueFilters';
import { formatQtd, parseQtd } from '@/lib/format';
import { consumirFefo, setorControlaValidade } from '@/lib/lotes';
import ValidadeBadge from '@/components/ValidadeBadge';
import ProductSearchSelect from '@/components/ProductSearchSelect';
import NfeImportButton from '@/components/NfeImportButton';
import MovimentacaoDetalhe from '@/components/MovimentacaoDetalhe';

const emptyForm = { produto_id: '', tipo: 'entrada', quantidade: 1, observacao: '', codigo_lote: '', data_validade: '', numero_nf: '', fornecedor: '', chave_acesso: '' };

export default function Movimentacoes() {
  const [produtos, setProdutos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const [p, s, m, g, l, movs] = await Promise.all([
      base44.entities.Produto.list(),
      base44.entities.Setor.list(),
      base44.entities.Maquina.list(),
      base44.entities.Gaveta.list(),
      base44.entities.Lote.list(),
      base44.entities.Movimentacao.list('-data', 50),
    ]);
    setProdutos(p); setSetores(s); setMaquinas(m); setGavetas(g); setLotes(l); setMovimentacoes(movs);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const produtoSelecionado = produtos.find((p) => p.id === form.produto_id);
  const controlaValidade = produtoSelecionado
    ? setorControlaValidade(produtoSelecionado.setor_id, setores)
    : false;
  const lotesDoProduto = produtoSelecionado
    ? lotes.filter((l) => l.produto_id === produtoSelecionado.id)
    : [];

  async function handleUndo(mov) {
    const produto = produtos.find((p) => p.id === mov.produto_id);
    setSaving(true);
    try {
      if (mov.lote_id || mov.lotes_consumidos) {
        if (mov.tipo === 'entrada') {
          const lote = lotes.find((l) => l.id === mov.lote_id);
          if (lote) {
            const novaQtdLote = Math.max(0, (lote.quantidade || 0) - (mov.quantidade || 0));
            await base44.entities.Lote.update(lote.id, { quantidade: novaQtdLote });
          }
        } else {
          const consumidos = mov.lotes_consumidos
            ? JSON.parse(mov.lotes_consumidos)
            : (mov.lote_id ? [{ lote_id: mov.lote_id, quantidade: mov.quantidade }] : []);
          for (const c of consumidos) {
            const l = lotes.find((x) => x.id === c.lote_id);
            if (l) await base44.entities.Lote.update(l.id, { quantidade: (l.quantidade || 0) + c.quantidade });
          }
        }
        if (produto) {
          const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
          let total = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0);
          total = mov.tipo === 'entrada' ? total - (mov.quantidade || 0) : total + (mov.quantidade || 0);
          await base44.entities.Produto.update(produto.id, { quantidade: Math.max(0, total) });
        }
      } else {
        if (produto) {
          const qtdAtual = produto.quantidade || 0;
          const novaQtd =
            mov.tipo === 'entrada'
              ? Math.max(0, qtdAtual - (mov.quantidade || 0))
              : qtdAtual + (mov.quantidade || 0);
          await base44.entities.Produto.update(produto.id, { quantidade: novaQtd });
        }
      }
      await base44.entities.Movimentacao.update(mov.id, { tipo: 'estorno' });
      toast({ title: 'Movimentação estornada', description: `${mov.nome_produto} — estoque atualizado.` });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const produto = produtos.find((p) => p.id === form.produto_id);
    if (!produto) return;
    setSaving(true);
    try {
      const qtd = parseQtd(form.quantidade);
      if (!(qtd > 0)) {
        toast({ title: 'Quantidade inválida', description: 'Informe uma quantidade maior que zero.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      const now = new Date().toISOString();
      const baseMov = {
        data: now,
        produto_id: produto.id,
        codigo: produto.codigo,
        nome_produto: produto.nome,
        quantidade: qtd,
        setor_id: produto.setor_id,
        maquina_id: produto.maquina_id,
        gaveta_id: produto.gaveta_id,
        tipo: form.tipo,
        observacao: form.observacao,
        numero_nf: form.tipo === 'entrada' ? (form.numero_nf || '') : '',
        fornecedor: form.tipo === 'entrada' ? (form.fornecedor || '') : '',
        chave_acesso: form.tipo === 'entrada' ? (form.chave_acesso || '') : '',
      };

      if (controlaValidade) {
        if (form.tipo === 'entrada') {
          if (!form.codigo_lote || !form.data_validade) {
            toast({ title: 'Lote e validade obrigatórios', description: 'Este setor controla validade.', variant: 'destructive' });
            return;
          }
          let lote = lotes.find(
            (l) => l.produto_id === produto.id && l.codigo_lote === form.codigo_lote && l.data_validade === form.data_validade
          );
          let loteId;
          if (lote) {
            loteId = lote.id;
            await base44.entities.Lote.update(lote.id, { quantidade: (lote.quantidade || 0) + qtd });
          } else {
            const created = await base44.entities.Lote.create({
              produto_id: produto.id,
              setor_id: produto.setor_id,
              maquina_id: produto.maquina_id || '',
              gaveta_id: produto.gaveta_id || '',
              codigo_lote: form.codigo_lote,
              data_validade: form.data_validade,
              quantidade: qtd,
              unidade: produto.unidade || 'un',
            });
            loteId = created.id;
          }
          await base44.entities.Movimentacao.create({ ...baseMov, lote_id: loteId, data_validade: form.data_validade });
          const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
          const novaQtd = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0) + qtd;
          await base44.entities.Produto.update(produto.id, { quantidade: novaQtd });
        } else {
          const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
          const { alocacoes, totalDisponivel, suficiente } = consumirFefo(lotesProduto, qtd);
          if (!suficiente) {
            toast({
              title: 'Saldo insuficiente em lotes válidos',
              description: `Disponível: ${formatQtd(totalDisponivel)} ${produto.unidade || 'un'}.`,
              variant: 'destructive',
            });
            return;
          }
          for (const a of alocacoes) {
            const l = lotesProduto.find((x) => x.id === a.lote_id);
            await base44.entities.Lote.update(a.lote_id, { quantidade: (l.quantidade || 0) - a.quantidade });
          }
          await base44.entities.Movimentacao.create({
            ...baseMov,
            lote_id: alocacoes[0]?.lote_id || '',
            data_validade: alocacoes[0]?.data_validade || '',
            lotes_consumidos: JSON.stringify(alocacoes),
          });
          const novaQtd = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0) - qtd;
          await base44.entities.Produto.update(produto.id, { quantidade: Math.max(0, novaQtd) });
        }
      } else {
        await base44.entities.Movimentacao.create(baseMov);
        const novaQtd =
          form.tipo === 'entrada'
            ? (produto.quantidade || 0) + qtd
            : Math.max(0, (produto.quantidade || 0) - qtd);
        await base44.entities.Produto.update(produto.id, { quantidade: novaQtd });
      }
      toast({ title: 'Movimentação registrada com sucesso' });
      setForm(emptyForm);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Movimentações</h1>
        <p className="text-sm text-muted-foreground mt-1">Registre entradas e saídas de estoque</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Nova Movimentação</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <ProductSearchSelect
                produtos={produtos}
                maquinas={maquinas}
                gavetas={gavetas}
                value={form.produto_id}
                onChange={(v) => setForm({ ...form, produto_id: v, codigo_lote: '', data_validade: '' })}
                placeholder="Buscar produto por nome, código, referência…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label htmlFor="mv-qtd">Quantidade *</Label>
                <Input id="mv-qtd" type="text" inputMode="decimal" placeholder="0,00" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} required />
              </div>
            </div>

            {controlaValidade && form.tipo === 'entrada' && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="space-y-1.5">
                  <Label htmlFor="mv-lote">Lote *</Label>
                  <Input id="mv-lote" value={form.codigo_lote} onChange={(e) => setForm({ ...form, codigo_lote: e.target.value })} placeholder="Ex.: L1234" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mv-val">Validade *</Label>
                  <Input id="mv-val" type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} required />
                </div>
              </div>
            )}
            {controlaValidade && form.tipo === 'saida' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <CalendarClock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Saída consumida automaticamente pelo critério FEFO (primeiro lote a vencer). {lotesDoProduto.length} lote(s) disponível(is).</span>
              </div>
            )}

            {form.tipo === 'entrada' && (
              <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-nf">Número da NF</Label>
                    <Input id="mv-nf" value={form.numero_nf} onChange={(e) => setForm({ ...form, numero_nf: e.target.value })} placeholder="Ex.: 000123456" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-forn">Fornecedor</Label>
                    <Input id="mv-forn" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} placeholder="Nome / CNPJ" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mv-chave">Chave de acesso da NF-e</Label>
                  <Input id="mv-chave" value={form.chave_acesso} onChange={(e) => setForm({ ...form, chave_acesso: e.target.value })} placeholder="44 dígitos" className="font-mono text-xs" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="mv-obs">Observação</Label>
              <Textarea id="mv-obs" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !form.produto_id}>
              <Plus className="w-4 h-4 mr-2" />
              {saving ? 'Registrando…' : 'Registrar Movimentação'}
            </Button>
          </form>

          {form.tipo === 'entrada' && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">Ou importe uma NF-e:</p>
              <NfeImportButton produtos={produtos} setores={setores} maquinas={maquinas} gavetas={gavetas} onImported={load} />
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Movimentações Recentes</h3>
              {selectedId && (() => {
                 const sel = movimentacoes.find((m) => m.id === selectedId);
                 return sel ? (
                   <Button
                     variant="destructive"
                     size="sm"
                     disabled={saving || sel.tipo === 'estorno'}
                     onClick={() => handleUndo(sel)}
                   >
                     <Undo2 className="w-4 h-4 mr-1" />
                     {saving ? 'Estornando…' : sel.tipo === 'estorno' ? 'Estornada' : 'Estornar Movimentação'}
                   </Button>
                 ) : null;
               })()}
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : movimentacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="rounded-lg border overflow-auto scrollbar-thin max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>NF / Fornecedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.map((m) => (
                      <TableRow
                        key={m.id}
                        onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
                        className={`cursor-pointer transition-colors ${selectedId === m.id ? 'bg-accent' : 'hover:bg-muted/50'}`}
                      >
                        <TableCell className="text-sm whitespace-nowrap">
                          {m.data ? new Date(m.data).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{m.nome_produto || '—'}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatQtd(m.quantidade || 0)}{' '}
                          <span className="text-xs text-muted-foreground font-normal">{produtos.find((p) => p.id === m.produto_id)?.unidade || ''}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.codigo}</TableCell>
                        <TableCell className="text-xs">
                          {m.numero_nf ? (
                            <span className="font-mono" title={m.chave_acesso ? `Chave: ${m.chave_acesso}` : undefined}>NF {m.numero_nf}</span>
                          ) : null}
                          {m.fornecedor ? <span className="block text-muted-foreground truncate max-w-[140px]">{m.fornecedor}</span> : null}
                          {!m.numero_nf && !m.fornecedor ? '—' : null}
                        </TableCell>
                        <TableCell>
                          {m.tipo === 'entrada' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                              <ArrowDownCircle className="w-3 h-3" /> Entrada
                            </Badge>
                          ) : m.tipo === 'saida' ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                              <ArrowUpCircle className="w-3 h-3" /> Saída
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                              <Undo2 className="w-3 h-3" /> Estorno
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{getNome(m.setor_id, setores)}</TableCell>
                        <TableCell><ValidadeBadge dataValidade={m.data_validade} /></TableCell>
                        <TableCell className="text-center">
                          {selectedId === m.id && (
                            <Undo2 className="w-4 h-4 text-destructive mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              )}
              </Card>

              {selectedId && (() => {
              const sel = movimentacoes.find((m) => m.id === selectedId);
              return sel ? (
              <MovimentacaoDetalhe
                mov={sel}
                produtos={produtos}
                setores={setores}
                maquinas={maquinas}
                gavetas={gavetas}
                lotes={lotes}
              />
              ) : null;
              })()}
              </div>
              </div>
              </div>
              );
              }