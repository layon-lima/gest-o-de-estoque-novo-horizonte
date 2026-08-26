import { useState, useMemo } from 'react';
import { Plus, Undo2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
import { useEntidades } from '@/lib/useEntidades';
import { useToast } from '@/components/ui/use-toast';
import { formatQtd, parseQtd } from '@/lib/format';
import { consumirFefo, setorControlaValidade, proximoCodigoLote } from '@/lib/lotes';
import { reverterEstoqueMov, maxNumeroMovimento, formatarNumeroMov, liberarGavetaSeZerado } from '@/lib/movimentacoes';
import ProductSearchSelect from '@/components/ProductSearchSelect';
import FornecedorCombobox from '@/components/FornecedorCombobox';
import NfeImportButton from '@/components/NfeImportButton';
import MovimentacaoDetalhe from '@/components/MovimentacaoDetalhe';
import MovimentacaoRow from '@/components/MovimentacaoRow';
import NfeDropZone from '@/components/NfeDropZone';
import NfePreviewDialog from '@/components/NfePreviewDialog';
import { useNfeImport } from '@/hooks/useNfeImport';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const emptyForm = { produto_id: '', tipo: 'entrada', quantidade: 1, observacao: '', codigo_lote: '', data_validade: '', numero_nf: '', fornecedor: '', chave_acesso: '' };

export default function Movimentacoes() {
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [movToDelete, setMovToDelete] = useState(null);
  const { toast } = useToast();

  const { data, loading, reload: load } = useEntidades({
    Produto: {},
    Setor: {},
    Maquina: {},
    Gaveta: {},
    Lote: {},
    Movimentacao: { sort: '-data', limit: 50 },
    Pessoa: { sort: '-created_date', limit: 500 },
    User: {},
  });
  const {
    Produto: produtos, Setor: setores, Maquina: maquinas, Gaveta: gavetas, Lote: lotes,
    Movimentacao: movimentacoes, Pessoa: pessoas, User: usuarios,
  } = data;
  const nfe = useNfeImport({ produtos, setores, maquinas, gavetas, onImported: load });

  const fornecedores = useMemo(() => {
    const nomes = new Set();
    pessoas.filter((p) => p.is_fornecedor).forEach((p) => p.nome && nomes.add(p.nome));
    movimentacoes.forEach((m) => { if (m.fornecedor) nomes.add(m.fornecedor); });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b));
  }, [pessoas, movimentacoes]);

  const produtoSelecionado = produtos.find((p) => p.id === form.produto_id);
  const controlaValidade = produtoSelecionado
    ? setorControlaValidade(produtoSelecionado.setor_id, setores)
    : false;
  const lotesDoProduto = produtoSelecionado
    ? lotes.filter((l) => l.produto_id === produtoSelecionado.id)
    : [];

  async function handleUndo(mov) {
    setSaving(true);
    try {
      await reverterEstoqueMov(mov, { produtos, lotes });
      await base44.entities.Movimentacao.create({
        data: new Date().toISOString(),
        numero: formatarNumeroMov(maxNumeroMovimento(movimentacoes) + 1),
        produto_id: mov.produto_id,
        codigo: mov.codigo,
        nome_produto: mov.nome_produto,
        quantidade: mov.quantidade,
        setor_id: mov.setor_id,
        maquina_id: mov.maquina_id,
        gaveta_id: mov.gaveta_id,
        tipo: 'estorno',
        observacao: `Estorno da movimentação de ${mov.tipo} (${mov.data ? new Date(mov.data).toLocaleString('pt-BR') : ''})`,
        numero_nf: mov.numero_nf || '',
        fornecedor: mov.fornecedor || '',
        chave_acesso: mov.chave_acesso || '',
        lote_id: mov.lote_id || '',
        data_validade: mov.data_validade || '',
        lotes_consumidos: mov.lotes_consumidos || '',
      });
      await base44.entities.Movimentacao.update(mov.id, { estornada: true });
      toast({ title: 'Movimentação estornada', description: `${mov.nome_produto} — estoque atualizado e auditoria mantida.` });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mov) {
    setSaving(true);
    try {
      await reverterEstoqueMov(mov, { produtos, lotes });
      await base44.entities.Movimentacao.delete(mov.id);
      toast({ title: 'Movimentação excluída', description: `${mov.nome_produto} — estoque revertido e registro removido.` });
      if (selectedId === mov.id) setSelectedId(null);
      setMovToDelete(null);
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
      if (form.tipo === 'entrada' && form.chave_acesso) {
        const existentes = await base44.entities.Movimentacao.filter({ chave_acesso: form.chave_acesso });
        const ativas = existentes.filter((m) => m.tipo === 'entrada' && m.estornada !== true);
        if (ativas.length > 0) {
          toast({ title: 'Nota fiscal duplicada', description: 'Esta NF-e já está ativa no estoque. Estorne a entrada anterior para lançá-la novamente.', variant: 'destructive' });
          setSaving(false);
          return;
        }
      }
      const now = new Date().toISOString();
      const baseMov = {
        data: now,
        numero: formatarNumeroMov(maxNumeroMovimento(movimentacoes) + 1),
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
          if (!form.data_validade) {
            toast({ title: 'Validade obrigatória', description: 'Este setor controla validade. O código do lote é gerado automaticamente.', variant: 'destructive' });
            return;
          }
          // Lote interno: soma a um lote existente do mesmo produto com a mesma
          // validade; se não houver, cria novo lote com código interno automático
          // (sequencial por produto, ex.: P0001-L01).
          let lote = lotes.find(
            (l) => l.produto_id === produto.id && l.data_validade === form.data_validade
          );
          let loteId;
          if (lote) {
            loteId = lote.id;
            await base44.entities.Lote.update(lote.id, { quantidade: (lote.quantidade || 0) + qtd });
            lote.quantidade = (lote.quantidade || 0) + qtd;
          } else {
            const created = await base44.entities.Lote.create({
              produto_id: produto.id,
              codigo_referencia: produto.codigo_referencia || '',
              setor_id: produto.setor_id,
              maquina_id: produto.maquina_id || '',
              gaveta_id: produto.gaveta_id || '',
              codigo_lote: proximoCodigoLote(produto, lotes),
              data_validade: form.data_validade,
              quantidade: qtd,
              unidade: produto.unidade || 'un',
            });
            loteId = created.id;
            lotes.push(created);
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
            const novaQtdLote = (l.quantidade || 0) - a.quantidade;
            await base44.entities.Lote.update(a.lote_id, {
              quantidade: novaQtdLote,
              ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}),
            });
            l.quantidade = novaQtdLote;
            if (novaQtdLote <= 0) l.gaveta_id = '';
          }
          await base44.entities.Movimentacao.create({
            ...baseMov,
            lote_id: alocacoes[0]?.lote_id || '',
            data_validade: alocacoes[0]?.data_validade || '',
            lotes_consumidos: JSON.stringify(alocacoes),
          });
          const novaQtd = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0) - qtd;
          const totalFinal = Math.max(0, novaQtd);
          await base44.entities.Produto.update(produto.id, {
            quantidade: totalFinal,
            ...(totalFinal <= 0 ? { gaveta_id: '' } : {}),
          });
          produto.quantidade = totalFinal;
          if (totalFinal <= 0) produto.gaveta_id = '';
        }
      } else {
        await base44.entities.Movimentacao.create(baseMov);
        const novaQtd =
          form.tipo === 'entrada'
            ? (produto.quantidade || 0) + qtd
            : Math.max(0, (produto.quantidade || 0) - qtd);
        await base44.entities.Produto.update(produto.id, {
          quantidade: novaQtd,
          ...(novaQtd <= 0 ? { gaveta_id: '' } : {}),
        });
        produto.quantidade = novaQtd;
        if (novaQtd <= 0) produto.gaveta_id = '';
      }
      toast({ title: 'Movimentação registrada com sucesso' });
      setForm(emptyForm);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <NfeDropZone onDropFile={nfe.processFile} disabled={nfe.importing}>
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Movimentações</h1>
        <p className="text-sm text-muted-foreground mt-1">Registre entradas e saídas de estoque</p>
      </header>

      <div className="space-y-6">
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
              {produtoSelecionado && (
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-muted-foreground">Estoque atual:</span>
                  <span className="font-semibold tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    {formatQtd(produtoSelecionado.quantidade || 0)} {produtoSelecionado.unidade || ''}
                  </span>
                  {(produtoSelecionado.estoque_minimo || 0) > 0 && (
                    <span className="text-muted-foreground">
                      (mín.: {formatQtd(produtoSelecionado.estoque_minimo)} {produtoSelecionado.unidade || ''})
                    </span>
                  )}
                </div>
              )}
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
                  <Label>Lote interno</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-dashed border-amber-300 bg-amber-50/50 text-xs text-amber-700 italic">
                    Gerado automaticamente na entrada
                  </div>
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
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-nf">Número da NF</Label>
                    <Input id="mv-nf" value={form.numero_nf} onChange={(e) => setForm({ ...form, numero_nf: e.target.value })} placeholder="Ex.: 000123456" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-forn">Fornecedor</Label>
                    <FornecedorCombobox
                      id="mv-forn"
                      value={form.fornecedor}
                      onChange={(v) => setForm({ ...form, fornecedor: v })}
                      suggestions={fornecedores}
                      placeholder="Nome / CNPJ"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mv-chave">Chave de acesso da NF-e</Label>
                    <Input id="mv-chave" value={form.chave_acesso} onChange={(e) => setForm({ ...form, chave_acesso: e.target.value })} placeholder="44 dígitos" className="font-mono text-xs" />
                  </div>
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
              <NfeImportButton importing={nfe.importing} onFile={nfe.processFile} />
            </div>
          )}
        </Card>

        <div>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Movimentações Recentes</h3>
              {selectedId && (() => {
                 const sel = movimentacoes.find((m) => m.id === selectedId);
                 return sel ? (
                   <Button
                     variant="destructive"
                     size="sm"
                     disabled={saving || sel.estornada === true || sel.tipo === 'estorno'}
                     onClick={() => handleUndo(sel)}
                   >
                     <Undo2 className="w-4 h-4 mr-1" />
                     {saving ? 'Estornando…' : sel.estornada === true ? 'Estornada' : 'Estornar Movimentação'}
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
                      <TableHead>Hora</TableHead>
                      <TableHead>Usuário</TableHead>
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
                      <MovimentacaoRow
                        key={m.id}
                        mov={m}
                        isSelected={selectedId === m.id}
                        onSelect={() => setSelectedId(selectedId === m.id ? null : m.id)}
                        onSwipeDelete={setMovToDelete}
                        produtos={produtos}
                        setores={setores}
                        maquinas={maquinas}
                        gavetas={gavetas}
                        usuarios={usuarios}
                      />
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

              <AlertDialog open={!!movToDelete} onOpenChange={(o) => !o && setMovToDelete(null)}>
               <AlertDialogContent>
                 <AlertDialogHeader>
                   <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                   <AlertDialogDescription>
                     {movToDelete ? `Esta ação reverte o estoque de "${movToDelete.nome_produto}" e remove o registro permanentemente. Não dá para desfazer.` : ''}
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                   <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
                   <AlertDialogAction
                     disabled={saving}
                     onClick={() => movToDelete && handleDelete(movToDelete)}
                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                   >
                     {saving ? 'Excluindo…' : 'Excluir'}
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
              </AlertDialog>

              {nfe.preview && (
                <NfePreviewDialog
                  open
                  nfeInfo={{ nNF: nfe.preview.nNF, emitente: nfe.preview.emitente, chave: nfe.preview.chave }}
                  items={nfe.preview.items}
                  produtos={produtos}
                  setores={setores}
                  maquinas={maquinas}
                  gavetas={gavetas}
                  onClose={nfe.close}
                  onConfirm={nfe.confirm}
                />
              )}
              </div>
              </NfeDropZone>
              );
              }