import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Image as ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  Settings2,
  Warehouse,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ProductForm from '@/components/ProductForm';
import SearchSelect from '@/components/SearchSelect';
import { matchTerm } from '@/lib/estoqueFilters';
import { useEntidades } from '@/lib/useEntidades';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 8;
const STORAGE_KEY = 'erp_produtos_mostrar_imagens';
const COLUMNS_STORAGE_KEY = 'erp_produtos_colunas_lista';

function formatCurrency(value) {
  const number = Number(value) || 0;
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatQty(value) {
  const number = Number(value) || 0;
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ icon: Icon, label, value, helper, tone = 'default' }) {
  const toneMap = {
    default: 'border-border bg-card text-foreground',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    blue: 'border-sky-100 bg-sky-50 text-sky-700',
  };

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneMap[tone] || toneMap.default}`}>
      <div className="flex min-h-[48px] items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {label}
          </p>

          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <p className="shrink-0 text-lg font-semibold leading-none">{value}</p>
            {helper ? (
              <p className="truncate text-[9px] text-muted-foreground">{helper}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function smartLabel(value) {
  if (value === null || value === undefined || value === '') return '—';

  const text = String(value).trim();
  if (!text || text === '—') return '—';

  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letters) return text;

  const upperCount = (letters.match(/[A-ZÀ-Ý]/g) || []).length;
  const upperRatio = upperCount / letters.length;
  if (upperRatio < 0.7) return text;

  return text
    .split(' • ')
    .map((piece) => piece
      .split(' — ')
      .map((segment) => (/^[A-Z]{2,}-?\d/.test(segment) ? segment : segment.toLowerCase().replace(/(^|\s|[-/])([a-zà-ÿ])/g, (m, sep, ch) => `${sep}${ch.toUpperCase()}`)))
      .join(' — '))
    .join(' • ');
}

function ProductThumb({ produto }) {
  const [erro, setErro] = useState(false);
  const hasImage = !!produto?.foto_url && !erro;

  if (hasImage) {
    return (
      <img
        src={produto.foto_url}
        alt={produto.nome || 'Produto'}
        className="h-11 w-11 rounded-xl border object-cover"
        onError={() => setErro(true)}
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground">
      <ImageIcon className="h-5 w-5" />
    </div>
  );
}

export default function ProdutosManager() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filtros, setFiltros] = useState({
    setor_id: '',
    estoque: '',
    deposito_id: '',
    maquina_id: '',
    gaveta_id: '',
  });
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [mostrarImagens, setMostrarImagens] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? true : saved === '1';
  });
  const [menuColunasAberto, setMenuColunasAberto] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        imagem: true,
        quantidade: true,
        valorUnit: true,
        valorTotal: true,
        codigo: true,
        referencia: true,
        setor: true,
        deposito: true,
        maquina: true,
        gaveta: true,
        acoes: true,
      };
    }

    try {
      const saved = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (!saved) throw new Error('no-storage');
      return {
        imagem: true,
        quantidade: true,
        valorUnit: true,
        valorTotal: true,
        codigo: true,
        referencia: true,
        setor: true,
        deposito: true,
        maquina: true,
        gaveta: true,
        acoes: true,
        ...JSON.parse(saved),
      };
    } catch (_) {
      return {
        imagem: true,
        quantidade: true,
        valorUnit: true,
        valorTotal: true,
        codigo: true,
        referencia: true,
        setor: true,
        deposito: true,
        maquina: true,
        gaveta: true,
        acoes: true,
      };
    }
  });

  const { data, loading, reload: load } = useEntidades({
    Produto: {},
    Setor: {},
    Deposito: {},
    Maquina: {},
    Gaveta: {},
    SaldoEstoque: {},
  });

  const {
    Produto: produtos = [],
    Setor: setores = [],
    Deposito: depositos = [],
    Maquina: maquinas = [],
    Gaveta: gavetas = [],
    SaldoEstoque: saldos = [],
  } = data;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mostrarImagens ? '1' : '0');
    }
  }, [mostrarImagens]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleCols));
    }
  }, [visibleCols]);

  const saldoPorProduto = useMemo(() => {
    const mapa = new Map();

    for (const saldo of saldos || []) {
      const key = saldo?.produto_id || saldo?.product_id || saldo?.produtoId;
      if (!key) continue;
      const atual = mapa.get(key) || 0;
      mapa.set(key, atual + (Number(saldo?.quantidade) || 0));
    }

    return mapa;
  }, [saldos]);

  const dataset = useMemo(() => {
    return produtos.map((produto) => {
      const quantidadeSaldo = saldoPorProduto.has(produto.id)
        ? saldoPorProduto.get(produto.id)
        : Number(produto.quantidade) || 0;
      const custoUnitario = Number(produto.custo_unitario) || 0;
      const estoqueMinimo = Number(produto.estoque_minimo) || 0;
      const valorTotal = quantidadeSaldo * custoUnitario;

      let status = { label: 'Alto', tone: 'green' };
      if (quantidadeSaldo <= 0) {
        status = { label: 'Zerado', tone: 'red' };
      } else if (estoqueMinimo > 0 && quantidadeSaldo <= estoqueMinimo) {
        status = { label: 'Baixo', tone: 'amber' };
      }

      return {
        ...produto,
        quantidade_exibicao: quantidadeSaldo,
        custo_exibicao: custoUnitario,
        valor_total_exibicao: valorTotal,
        status_estoque: status,
      };
    });
  }, [produtos, saldoPorProduto]);

  const filtered = useMemo(() => {
    let result = [...dataset];

    if (filtros.setor_id) result = result.filter((p) => p.setor_id === filtros.setor_id);
    if (filtros.deposito_id) result = result.filter((p) => p.deposito_id === filtros.deposito_id);
    if (filtros.maquina_id) result = result.filter((p) => p.maquina_id === filtros.maquina_id);
    if (filtros.gaveta_id) result = result.filter((p) => p.gaveta_id === filtros.gaveta_id);

    if (filtros.estoque === 'com_estoque') result = result.filter((p) => p.quantidade_exibicao > 0);
    if (filtros.estoque === 'zerado') result = result.filter((p) => p.quantidade_exibicao <= 0);
    if (filtros.estoque === 'baixo') {
      result = result.filter((p) => (Number(p.estoque_minimo) || 0) > 0 && p.quantidade_exibicao > 0 && p.quantidade_exibicao <= Number(p.estoque_minimo || 0));
    }

    if (!busca.trim()) return result;

    const termos = busca
      .split(',')
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);

    if (!termos.length) return result;

    return result.filter((p) => termos.every((termo) => matchTerm(p, termo, maquinas, gavetas, depositos, saldos)));
  }, [dataset, filtros, busca, maquinas, gavetas, depositos, saldos]);

  useEffect(() => {
    setPagina(1);
  }, [busca, filtros]);

  const totals = useMemo(() => {
    const total = dataset.length;
    const comEstoque = dataset.filter((p) => p.quantidade_exibicao > 0).length;
    const baixo = dataset.filter((p) => p.status_estoque.label === 'Baixo').length;
    const valor = dataset.reduce((acc, p) => acc + p.valor_total_exibicao, 0);

    return { total, comEstoque, baixo, valor };
  }, [dataset]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * PAGE_SIZE;
  const paginaRows = filtered.slice(inicio, inicio + PAGE_SIZE);

  const getNome = (lista, id, campo = 'nome') => lista.find((item) => item.id === id)?.[campo] || '—';
  const getDeposito = (id) => {
    const deposito = depositos.find((item) => item.id === id);
    if (!deposito) return '—';
    return deposito.nome ? `${deposito.numero} — ${deposito.nome}` : deposito.numero || '—';
  };

  const columnOptions = [
    { key: 'imagem', label: 'Imagem' },
    { key: 'quantidade', label: 'Quantidade' },
    { key: 'valorUnit', label: 'Valor unit.' },
    { key: 'valorTotal', label: 'Valor total' },
    { key: 'codigo', label: 'Código' },
    { key: 'referencia', label: 'Ref.' },
    { key: 'setor', label: 'Setor' },
    { key: 'deposito', label: 'Depósito' },
    { key: 'maquina', label: 'Máquina' },
    { key: 'gaveta', label: 'Gaveta' },
    { key: 'acoes', label: 'Ações' },
  ];

  function toggleColumn(key) {
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(produto) {
    setEditing(produto);
    setFormOpen(true);
  }

  function handleFormOpenChange(value) {
    setFormOpen(value);
    if (!value) setEditing(null);
  }

  function clearFilters() {
    setFiltros({
      setor_id: '',
      estoque: '',
      deposito_id: '',
      maquina_id: '',
      gaveta_id: '',
    });
    setBusca('');
  }


  if (formOpen) {
    return (
      <ProductForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        produto={editing}
        setores={setores}
        depositos={depositos}
        maquinas={maquinas}
        gavetas={gavetas}
        onSaved={load}
        produtos={produtos}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b bg-muted/20 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Estoque
                </p>
                <h3 className="text-[30px] font-semibold leading-none tracking-tight">Produtos</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Visualização do cadastro mestre, posição de estoque e vínculos operacionais.
                </p>
              </div>
            </div>

            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo produto
            </Button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Package} label="Produtos" value={totals.total} helper="cadastro mestre" />
            <StatCard icon={Warehouse} label="Com estoque" value={totals.comEstoque} helper="itens com saldo" tone="green" />
            <StatCard icon={Filter} label="Baixo estoque" value={totals.baixo} helper="atenção de reposição" tone="amber" />
            <StatCard icon={Package} label="Valor estimado" value={formatCurrency(totals.valor)} helper="quantidade × custo" tone="blue" />
          </div>

          <Card className="rounded-2xl border shadow-none">
            <div className="space-y-4 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative w-full xl:max-w-2xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, código ou referência... (vírgulas combinam)"
                    className="pl-9"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setMostrarImagens((prev) => !prev)}
                  >
                    {mostrarImagens ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {mostrarImagens ? 'Ocultar imagens' : 'Mostrar imagens'}
                  </Button>

                  <Button type="button" variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <SearchSelect
                  value={filtros.setor_id || 'all'}
                  onChange={(value) => setFiltros((prev) => ({ ...prev, setor_id: value === 'all' ? '' : value }))}
                  allLabel="Todos os setores"
                  placeholder="Filtrar setor"
                  options={setores.map((item) => ({ value: item.id, label: item.nome })).sort((a, b) => a.label.localeCompare(b.label))}
                />

                <SearchSelect
                  value={filtros.estoque || 'all'}
                  onChange={(value) => setFiltros((prev) => ({ ...prev, estoque: value === 'all' ? '' : value }))}
                  allLabel="Todo estoque"
                  placeholder="Filtrar estoque"
                  options={[
                    { value: 'com_estoque', label: 'Com estoque' },
                    { value: 'baixo', label: 'Baixo estoque' },
                    { value: 'zerado', label: 'Zerados' },
                  ]}
                />

                <SearchSelect
                  value={filtros.deposito_id || 'all'}
                  onChange={(value) => setFiltros((prev) => ({ ...prev, deposito_id: value === 'all' ? '' : value }))}
                  allLabel="Todos os depósitos"
                  placeholder="Filtrar depósito"
                  options={depositos
                    .map((item) => ({ value: item.id, label: item.nome ? `${item.numero} — ${item.nome}` : item.numero || 'Sem número' }))
                    .sort((a, b) => a.label.localeCompare(b.label))}
                />

                <SearchSelect
                  value={filtros.maquina_id || 'all'}
                  onChange={(value) => setFiltros((prev) => ({ ...prev, maquina_id: value === 'all' ? '' : value }))}
                  allLabel="Todas as máquinas"
                  placeholder="Filtrar máquina"
                  options={maquinas.map((item) => ({ value: item.id, label: item.nome })).sort((a, b) => a.label.localeCompare(b.label))}
                />

                <SearchSelect
                  value={filtros.gaveta_id || 'all'}
                  onChange={(value) => setFiltros((prev) => ({ ...prev, gaveta_id: value === 'all' ? '' : value }))}
                  allLabel="Todas as gavetas"
                  placeholder="Filtrar gaveta"
                  options={gavetas
                    .map((item) => ({ value: item.id, label: item.codigo ? `${item.codigo}${item.descricao ? ` — ${item.descricao}` : ''}` : item.descricao || 'Gaveta' }))
                    .sort((a, b) => a.label.localeCompare(b.label))}
                />
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="rounded-2xl border p-12 text-center shadow-none">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
              <h4 className="text-lg font-semibold">Nenhum produto encontrado</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                Ajuste a busca/filtros ou cadastre um novo produto para começar.
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
                <Button onClick={handleNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo produto
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-2xl border shadow-none">
              <div className="relative flex flex-col gap-3 border-b bg-muted/20 px-4 py-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="text-base font-semibold">Produtos cadastrados</h4>
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} registro(s) encontrados {filtered.length !== produtos.length ? `de ${produtos.length}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setMenuColunasAberto((prev) => !prev)}
                  >
                    <Settings2 className="h-4 w-4" />
                    Colunas
                  </Button>
                  <Badge variant="outline">Página {paginaAtual} de {totalPaginas}</Badge>
                  <Badge variant="outline">Imagens {mostrarImagens ? 'ativas' : 'ocultas'}</Badge>
                </div>

                {menuColunasAberto ? (
                  <div className="absolute right-4 top-[calc(100%+0.5rem)] z-20 w-56 rounded-xl border bg-background p-3 shadow-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Escolher colunas
                    </p>
                    <div className="mt-3 space-y-2">
                      {columnOptions.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={item.key === 'imagem' ? mostrarImagens : !!visibleCols[item.key]}
                            onChange={() => {
                              if (item.key === 'imagem') {
                                setMostrarImagens((prev) => !prev);
                              } else {
                                toggleColumn(item.key);
                              }
                            }}
                            className="h-4 w-4 rounded border-border accent-primary"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mostrarImagens && visibleCols.imagem ? <TableHead className="w-[92px]">Imagem</TableHead> : null}
                      <TableHead className="min-w-[280px]">Produto</TableHead>
                      {visibleCols.quantidade ? <TableHead>Quantidade</TableHead> : null}
                      {visibleCols.valorUnit ? <TableHead>Valor unit.</TableHead> : null}
                      {visibleCols.valorTotal ? <TableHead>Valor total</TableHead> : null}
                      {visibleCols.codigo ? <TableHead>Código</TableHead> : null}
                      {visibleCols.referencia ? <TableHead>Ref.</TableHead> : null}
                      {visibleCols.setor ? <TableHead>Setor</TableHead> : null}
                      {visibleCols.deposito ? <TableHead>Depósito</TableHead> : null}
                      {visibleCols.maquina ? <TableHead>Máquina</TableHead> : null}
                      {visibleCols.gaveta ? <TableHead>Gaveta</TableHead> : null}
                      {visibleCols.acoes ? <TableHead className="text-right">Ações</TableHead> : null}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginaRows.map((produto) => (
                      <TableRow key={produto.id}>
                        {mostrarImagens && visibleCols.imagem ? (
                          <TableCell className="py-4">
                            <ProductThumb produto={produto} />
                          </TableCell>
                        ) : null}

                        <TableCell className="py-4">
                          <div className="min-w-[240px]">
                            <div className="flex items-center gap-2">
                              <p className="text-[15px] font-semibold leading-6 text-foreground">{smartLabel(produto.nome)}</p>
                              {produto.venda ? (
                                <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">Venda</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Unidade: <span className="font-medium text-foreground">{(produto.unidade || 'un').toLowerCase()}</span>
                              {produto.unidade_alt ? ` • Alt: ${String(produto.unidade_alt).toLowerCase()}` : ''}
                            </p>
                          </div>
                        </TableCell>

                        {visibleCols.quantidade ? (
                          <TableCell className="py-4">
                            <span className="font-semibold">{formatQty(produto.quantidade_exibicao)}</span>
                            <span className="ml-1 text-xs text-muted-foreground">{(produto.unidade || 'un').toLowerCase()}</span>
                          </TableCell>
                        ) : null}
                        {visibleCols.valorUnit ? <TableCell className="py-4">{formatCurrency(produto.custo_exibicao)}</TableCell> : null}
                        {visibleCols.valorTotal ? <TableCell className="py-4 font-medium">{formatCurrency(produto.valor_total_exibicao)}</TableCell> : null}
                        {visibleCols.codigo ? <TableCell className="py-4 font-mono text-xs">{produto.codigo || '—'}</TableCell> : null}
                        {visibleCols.referencia ? <TableCell className="py-4 font-mono text-xs text-muted-foreground">{produto.codigo_referencia || '—'}</TableCell> : null}
                        {visibleCols.setor ? <TableCell className="py-4">{smartLabel(getNome(setores, produto.setor_id))}</TableCell> : null}
                        {visibleCols.deposito ? <TableCell className="py-4">{smartLabel(getDeposito(produto.deposito_id))}</TableCell> : null}
                        {visibleCols.maquina ? <TableCell className="py-4">{smartLabel(getNome(maquinas, produto.maquina_id))}</TableCell> : null}
                        {visibleCols.gaveta ? <TableCell className="py-4">{smartLabel(getNome(gavetas, produto.gaveta_id, 'codigo'))}</TableCell> : null}
                        {visibleCols.acoes ? (
                          <TableCell className="py-4">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(produto)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando <span className="font-medium text-foreground">{paginaRows.length}</span> de{' '}
                  <span className="font-medium text-foreground">{filtered.length}</span> registro(s)
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPagina((prev) => Math.max(1, prev - 1))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPagina((prev) => Math.min(totalPaginas, prev + 1))}
                    className="gap-1"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
}
