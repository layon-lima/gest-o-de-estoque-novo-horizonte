import { useState, useMemo } from 'react';
import { Plus, CalendarClock, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import SearchSelect from '@/components/SearchSelect';
import { useEntidades } from '@/lib/useEntidades';
import { useToast } from '@/components/ui/use-toast';
import { formatQtd, parseQtd } from '@/lib/format';
import { consumirFefo, setorControlaValidade, proximoCodigoLote } from '@/lib/lotes';
import { sortGavetas } from '@/lib/gavetas';
import { registrarMovimentacao, registrarTransferencia } from '@/lib/movimentacoes';
import { saldoTotalProduto, depositosComSaldoDoProduto, gavetasComSaldoDoProduto } from '@/lib/saldos';
import ProductSearchSelect from '@/components/ProductSearchSelect';
import FornecedorCombobox from '@/components/FornecedorCombobox';
import NfeImportButton from '@/components/NfeImportButton';
import NfeDropZone from '@/components/NfeDropZone';
import NfePreviewDialog from '@/components/NfePreviewDialog';
import { useNfeImport } from '@/hooks/useNfeImport';

const emptyForm = { produto_id: '', tipo: 'entrada', quantidade: 1, deposito_id: '', gaveta_id: '', deposito_origem_id: '', gaveta_origem_id: '', deposito_destino_id: '', gaveta_destino_id: '', observacao: '', codigo_lote: '', data_validade: '', numero_nf: '', fornecedor: '', chave_acesso: '' };

export default function Movimentacoes() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const { data, reload: load } = useEntidades({
    Produto: {},
    Setor: {},
    Maquina: {},
    Gaveta: {},
    Deposito: {},
    Lote: {},
    SaldoEstoque: {},
    Movimentacao: { sort: '-data', limit: 50 },
    Pessoa: { sort: '-created_date', limit: 500 },
  });
  const {
    Produto: produtos, Setor: setores, Maquina: maquinas, Gaveta: gavetas, Deposito: depositos, Lote: lotes,
    SaldoEstoque: saldos, Movimentacao: movimentacoes, Pessoa: pessoas,
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

  // Saldo real do produto (soma das parcelas em SaldoEstoque) e depósitos/gavetas
  // onde ele possui estoque — usado para oferecer apenas opções válidas nas combos.
  const saldoTotal = useMemo(
    () => saldoTotalProduto(form.produto_id, saldos),
    [form.produto_id, saldos]
  );
  const temSaldo = saldoTotal > 0;
  const depositosComSaldo = useMemo(
    () => depositosComSaldoDoProduto(form.produto_id, saldos, depositos),
    [form.produto_id, saldos, depositos]
  );
  const gavetasComSaldoDep = useMemo(
    () => gavetasComSaldoDoProduto(form.produto_id, form.deposito_id, saldos, gavetas),
    [form.produto_id, form.deposito_id, saldos, gavetas]
  );
  const gavetasComSaldoOrigem = useMemo(
    () => gavetasComSaldoDoProduto(form.produto_id, form.deposito_origem_id, saldos, gavetas),
    [form.produto_id, form.deposito_origem_id, saldos, gavetas]
  );
  const tipoOptions = [
    { value: 'entrada', label: 'Entrada Nota Fiscal' },
    { value: 'saida', label: 'Baixa Estoque' },
    { value: 'transferencia', label: 'Transferência de Depósito' },
  ];

  const saldoOrigem = useMemo(() => {
    if (!produtoSelecionado || !form.deposito_origem_id) return 0;
    return (saldos || [])
      .filter(
        (s) =>
          s.produto_id === produtoSelecionado.id &&
          s.deposito_id === form.deposito_origem_id &&
          (!form.gaveta_origem_id || (s.gaveta_id || '') === form.gaveta_origem_id)
      )
      .reduce((sum, s) => sum + (s.quantidade || 0), 0);
  }, [produtoSelecionado, form.deposito_origem_id, form.gaveta_origem_id, saldos]);

  async function handleSubmit(e) {
    e.preventDefault();
    const produto = produtos.find((p) => p.id === form.produto_id);
    if (!produto) return;
    setSaving(true);
    try {
      if (form.tipo === 'transferencia') {
        await registrarTransferencia({ form, produto, lotes, saldos, movimentacoes, controlaValidade, depositos });
      } else {
        await registrarMovimentacao({ form, produto, lotes, saldos, movimentacoes, controlaValidade });
      }
      toast({ title: 'Movimentação registrada com sucesso' });
      setForm(emptyForm);
      load();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('NF_DUPLICADA')) {
        toast({ variant: 'destructive', title: 'Nota fiscal duplicada', description: 'Esta NF-e já está ativa no estoque.' });
      } else if (msg.startsWith('VALIDADE_OBRIGATORIA')) {
        toast({ variant: 'destructive', title: 'Validade obrigatória', description: 'Este setor controla validade. Informe a data de validade.' });
      } else if (msg.startsWith('DEPOSITO_OBRIGATORIO')) {
        toast({ variant: 'destructive', title: 'Depósito obrigatório', description: 'Selecione o depósito onde o estoque será movimentado.' });
      } else if (msg.startsWith('ORIGEM_DESTINO_IGUAIS')) {
        toast({ variant: 'destructive', title: 'Origem e destino iguais', description: 'Selecione depósitos ou gavetas diferentes para a transferência.' });
      } else if (msg.startsWith('SALDO_INSUFICIENTE')) {
        const disp = Number(msg.split(':')[1] || 0);
        toast({ variant: 'destructive', title: 'Saldo insuficiente', description: `Disponível: ${formatQtd(disp)} ${produto.unidade || 'un'}.` });
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
                onChange={(v) => setForm({ ...form, produto_id: v, tipo: 'entrada', deposito_id: '', gaveta_id: '', deposito_origem_id: '', gaveta_origem_id: '', deposito_destino_id: '', gaveta_destino_id: '', codigo_lote: '', data_validade: '' })}
                placeholder="Buscar produto por nome, código, referência…"
              />
              {produtoSelecionado && (
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-muted-foreground">Estoque atual:</span>
                  <span className="font-semibold tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    {formatQtd(saldoTotal)} {produtoSelecionado.unidade || ''}
                  </span>
                  {(produtoSelecionado.estoque_minimo || 0) > 0 && (
                    <span className="text-muted-foreground">
                      (mín.: {formatQtd(produtoSelecionado.estoque_minimo)} {produtoSelecionado.unidade || ''})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <SearchSelect
                  value={form.tipo}
                  onChange={(v) => setForm({ ...form, tipo: v, deposito_id: '', gaveta_id: '', deposito_origem_id: '', gaveta_origem_id: '', deposito_destino_id: '', gaveta_destino_id: '' })}
                  placeholder="Tipo..."
                  options={tipoOptions}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mv-qtd">Quantidade *</Label>
                <Input id="mv-qtd" type="text" inputMode="decimal" placeholder="0,00" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} required />
              </div>
            </div>

            {form.tipo === 'transferencia' ? (
              <>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-red-50/60 border border-red-200">
                  <div className="col-span-2"><span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Origem (de onde sai)</span></div>
                  <div className="space-y-1.5">
                    <Label>Depósito de Origem *</Label>
                    <SearchSelect
                      value={form.deposito_origem_id}
                      onChange={(v) => setForm({ ...form, deposito_origem_id: v === 'all' ? '' : v, gaveta_origem_id: '' })}
                      allLabel="— Sem saldo —"
                      placeholder="Buscar depósito..."
                      disabled={!produtoSelecionado}
                      options={depositosComSaldo.map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' · ' + d.nome : ''}` }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gaveta de Origem <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                    <SearchSelect
                      value={form.gaveta_origem_id}
                      onChange={(v) => setForm({ ...form, gaveta_origem_id: v === 'all' ? '' : v })}
                      allLabel="— Todas —"
                      placeholder="Buscar gaveta..."
                      disabled={!form.deposito_origem_id}
                      options={gavetasComSaldoOrigem.map((g) => ({ value: g.id, label: g.codigo }))}
                    />
                  </div>
                  {form.deposito_origem_id && (
                    <div className="col-span-2 text-xs">
                      <span className="text-muted-foreground">Saldo disponível: </span>
                      <span className="font-semibold tabular-nums">{formatQtd(saldoOrigem)} {produtoSelecionado?.unidade || ''}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-green-50/60 border border-green-200">
                  <div className="col-span-2"><span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Destino (para onde vai)</span></div>
                  <div className="space-y-1.5">
                    <Label>Depósito de Destino *</Label>
                    <SearchSelect
                      value={form.deposito_destino_id}
                      onChange={(v) => setForm({ ...form, deposito_destino_id: v === 'all' ? '' : v, gaveta_destino_id: '' })}
                      allLabel="— Selecione —"
                      placeholder="Buscar depósito..."
                      options={depositos.map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' · ' + d.nome : ''}` }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gaveta de Destino <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                    <SearchSelect
                      value={form.gaveta_destino_id}
                      onChange={(v) => setForm({ ...form, gaveta_destino_id: v === 'all' ? '' : v })}
                      allLabel="— Nenhuma —"
                      placeholder="Buscar gaveta..."
                      disabled={!form.deposito_destino_id}
                      options={sortGavetas(gavetas.filter((g) => g.deposito_id === form.deposito_destino_id)).map((g) => ({ value: g.id, label: g.codigo }))}
                    />
                  </div>
                  {controlaValidade && (
                    <p className="col-span-2 text-xs text-blue-700">Setor controla validade: lotes consumidos por FEFO na origem e recriados no destino automaticamente.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Depósito *</Label>
                  <SearchSelect
                    value={form.deposito_id}
                    onChange={(v) => setForm({ ...form, deposito_id: v === 'all' ? '' : v, gaveta_id: '' })}
                    allLabel={form.tipo === 'saida' ? '— Sem saldo —' : '— Nenhum —'}
                    placeholder="Buscar depósito..."
                    disabled={form.tipo === 'saida' && !temSaldo}
                    options={(form.tipo === 'saida' ? depositosComSaldo : depositos).map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' · ' + d.nome : ''}` }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gaveta <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                  <SearchSelect
                    value={form.gaveta_id}
                    onChange={(v) => setForm({ ...form, gaveta_id: v === 'all' ? '' : v })}
                    allLabel="— Nenhum —"
                    placeholder="Buscar gaveta..."
                    disabled={!form.deposito_id}
                    options={(form.tipo === 'saida' ? gavetasComSaldoDep : sortGavetas(gavetas.filter((g) => !form.deposito_id || g.deposito_id === form.deposito_id))).map((g) => ({ value: g.id, label: g.codigo }))}
                  />
                </div>
              </div>
            )}

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
              </div>
              <div className="space-y-4">

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
                  <Textarea id="mv-obs" rows={4} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving || !form.produto_id || (form.tipo === 'transferencia' && (!form.deposito_origem_id || !form.deposito_destino_id))}>
              {form.tipo === 'transferencia' ? <ArrowRightLeft className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {saving ? 'Registrando…' : form.tipo === 'transferencia' ? 'Transferir' : 'Registrar Movimentação'}
            </Button>
          </form>

          {form.tipo === 'entrada' && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">Ou importe uma NF-e:</p>
              <NfeImportButton importing={nfe.importing} onFile={nfe.processFile} />
            </div>
          )}
        </Card>
      </div>

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