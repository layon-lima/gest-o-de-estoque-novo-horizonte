import { useState, useEffect, useMemo } from 'react';
import { FileDown, FileSpreadsheet, ArrowDownCircle, ArrowUpCircle, Undo2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import ProductsTable from '@/components/ProductsTable';
import { exportPDF, exportCSV } from '@/lib/exports';
import { getNome } from '@/lib/estoqueFilters';
import { formatQtd } from '@/lib/format';
import { useEntidades } from '@/lib/useEntidades';
import { filterLotesByFaixa, FAIXAS_VALIDADE, statusValidade } from '@/lib/lotes';
import ValidadeBadge from '@/components/ValidadeBadge';
import SearchSelect from '@/components/SearchSelect';
import { sortGavetas } from '@/lib/gavetas';

export default function Relatorios() {
  const [filtro, setFiltro] = useState({ setor_id: 'all', maquina_id: 'all', gaveta_id: 'all' });
  const [filtroValidade, setFiltroValidade] = useState({ setor_id: 'all', faixa: 'all' });
  const [filtroMov, setFiltroMov] = useState({ tipo: 'all', busca: '' });

  const { data, loading } = useEntidades({
    Produto: {},
    Setor: {},
    Maquina: {},
    Gaveta: {},
    Movimentacao: { sort: '-data', limit: 200 },
    Lote: {},
  });
  const {
    Produto: produtos, Setor: setores, Maquina: maquinas, Gaveta: gavetas,
    Movimentacao: movimentacoes, Lote: lotes,
  } = data;

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      if (filtro.setor_id !== 'all' && p.setor_id !== filtro.setor_id) return false;
      if (filtro.maquina_id !== 'all' && p.maquina_id !== filtro.maquina_id) return false;
      if (filtro.gaveta_id !== 'all' && p.gaveta_id !== filtro.gaveta_id) return false;
      return true;
    });
  }, [produtos, filtro]);

  // Opções em cascata: cada filtro mostra apenas opções com produtos em comum com os demais filtros ativos
  const setorOptions = useMemo(() => {
    const ids = new Set(
      produtos
        .filter((p) => p.setor_id && (filtro.maquina_id === 'all' || p.maquina_id === filtro.maquina_id) && (filtro.gaveta_id === 'all' || p.gaveta_id === filtro.gaveta_id))
        .map((p) => p.setor_id)
    );
    return setores.filter((s) => ids.has(s.id));
  }, [produtos, setores, filtro.maquina_id, filtro.gaveta_id]);

  const maquinaOptions = useMemo(() => {
    const ids = new Set(
      produtos
        .filter((p) => p.maquina_id && (filtro.setor_id === 'all' || p.setor_id === filtro.setor_id) && (filtro.gaveta_id === 'all' || p.gaveta_id === filtro.gaveta_id))
        .map((p) => p.maquina_id)
    );
    return maquinas.filter((m) => ids.has(m.id));
  }, [produtos, maquinas, filtro.setor_id, filtro.gaveta_id]);

  const gavetaOptions = useMemo(() => {
    const ids = new Set(
      produtos
        .filter((p) => p.gaveta_id && (filtro.setor_id === 'all' || p.setor_id === filtro.setor_id) && (filtro.maquina_id === 'all' || p.maquina_id === filtro.maquina_id))
        .map((p) => p.gaveta_id)
    );
    return gavetas.filter((g) => ids.has(g.id));
  }, [produtos, gavetas, filtro.setor_id, filtro.maquina_id]);

  // Reseta automaticamente valores que não existem mais nas opções derivadas
  useEffect(() => {
    setFiltro((f) => {
      const next = { ...f };
      if (f.setor_id !== 'all' && !setorOptions.some((s) => s.id === f.setor_id)) next.setor_id = 'all';
      if (f.maquina_id !== 'all' && !maquinaOptions.some((m) => m.id === f.maquina_id)) next.maquina_id = 'all';
      if (f.gaveta_id !== 'all' && !gavetaOptions.some((g) => g.id === f.gaveta_id)) next.gaveta_id = 'all';
      return next;
    });
  }, [setorOptions, maquinaOptions, gavetaOptions]);

  function buildRows() {
    return filtered.map((p) => {
      const qtd = p.quantidade || 0;
      const st = qtd === 0 ? 'Zerado' : 'Normal';
      return [
        p.nome,
        formatQtd(qtd),
        p.unidade || '',
        p.codigo,
        getNome(p.setor_id, setores),
        getNome(p.maquina_id, maquinas),
        getNome(p.gaveta_id, gavetas, 'codigo'),
        st,
      ];
    });
  }

  function handlePDF() {
    const cols = ['Produto', 'Quantidade', 'Unidade', 'Código', 'Setor', 'Máquina', 'Gaveta', 'Status'];
    exportPDF('Relatório de Estoque', cols, buildRows());
  }

  function handleCSV() {
    const cols = ['Produto', 'Quantidade', 'Unidade', 'Código', 'Setor', 'Máquina', 'Gaveta', 'Status'];
    exportCSV('Relatório de Estoque', cols, buildRows());
  }

  const setorNome = filtro.setor_id !== 'all' ? getNome(filtro.setor_id, setores) : 'Todos';
  const tituloRelatorio = `Estoque — ${setorNome} (${filtered.length} itens)`;

  const movimentacoesFiltradas = useMemo(() => {
    const termo = filtroMov.busca.trim().toLowerCase();
    return movimentacoes.filter((m) => {
      if (filtroMov.tipo !== 'all' && m.tipo !== filtroMov.tipo) return false;
      if (!termo) return true;
      const alvo = [m.nome_produto, m.codigo, m.numero_nf, m.fornecedor, m.chave_acesso, m.observacao]
        .filter(Boolean).join(' ').toLowerCase();
      return alvo.includes(termo);
    });
  }, [movimentacoes, filtroMov]);

  const movCols = ['Data/Hora', 'Tipo', 'Produto', 'Quantidade', 'Unidade', 'Código', 'Número NF', 'Fornecedor', 'Chave de Acesso', 'Setor', 'Máquina', 'Gaveta', 'Observação'];

  function buildMovRows() {
    return movimentacoesFiltradas.map((m) => {
      const prod = produtos.find((p) => p.id === m.produto_id);
      return [
        m.data ? new Date(m.data).toLocaleString('pt-BR') : '',
        m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'saida' ? 'Saída' : 'Estorno',
        m.nome_produto || '',
        formatQtd(m.quantidade || 0),
        prod?.unidade || '',
        m.codigo || '',
        m.numero_nf || '',
        m.fornecedor || '',
        m.chave_acesso || '',
        getNome(m.setor_id, setores),
        getNome(m.maquina_id, maquinas),
        getNome(m.gaveta_id, gavetas, 'codigo'),
        m.observacao || '',
      ];
    });
  }

  function handleMovPDF() {
    exportPDF('Relatório de Movimentações', movCols, buildMovRows());
  }

  function handleMovCSV() {
    exportCSV('Relatório de Movimentações', movCols, buildMovRows());
  }

  const lotesValidade = useMemo(() => {
    const now = new Date();
    let r = lotes.filter((l) => (l.quantidade || 0) > 0);
    if (filtroValidade.setor_id !== 'all') r = r.filter((l) => l.setor_id === filtroValidade.setor_id);
    r = filterLotesByFaixa(r, filtroValidade.faixa, now);
    return [...r].sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
  }, [lotes, filtroValidade]);

  function buildValidadeRows() {
    return lotesValidade.map((l) => {
      const produto = produtos.find((p) => p.id === l.produto_id);
      return [
        produto?.nome || '—',
        formatQtd(l.quantidade || 0),
        l.unidade || '',
        l.codigo_lote || '',
        l.data_validade ? new Date(l.data_validade).toLocaleDateString('pt-BR') : '—',
        statusValidade(l).label,
        getNome(l.setor_id, setores),
        getNome(l.maquina_id, maquinas),
        getNome(l.gaveta_id, gavetas, 'codigo'),
      ];
    });
  }

  function handleValidadePDF() {
    exportPDF('Relatório de Validade', ['Produto', 'Quantidade', 'Unidade', 'Lote', 'Validade', 'Status', 'Setor', 'Máquina', 'Gaveta'], buildValidadeRows());
  }
  function handleValidadeCSV() {
    exportCSV('Relatório de Validade', ['Produto', 'Quantidade', 'Unidade', 'Lote', 'Validade', 'Status', 'Setor', 'Máquina', 'Gaveta'], buildValidadeRows());
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Exporte relatórios em PDF ou Excel</p>
      </header>

      <Tabs defaultValue="estoque">
        <TabsList>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="entradas">Entradas e Saídas</TabsTrigger>
          <TabsTrigger value="validade">Validade</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="space-y-6 mt-4">
          <div className="flex items-center justify-end gap-2">
            <Button onClick={handlePDF} variant="outline" disabled={filtered.length === 0}>
              <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
            </Button>
            <Button onClick={handleCSV} disabled={filtered.length === 0}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
            </Button>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="text-sm font-semibold text-muted-foreground">Filtrar relatório:</span>
              <Select value={filtro.setor_id} onValueChange={(v) => setFiltro({ ...filtro, setor_id: v })}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setorOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <SearchSelect
                value={filtro.maquina_id}
                onChange={(v) => setFiltro({ ...filtro, maquina_id: v })}
                options={maquinaOptions.map((m) => ({ value: m.id, label: `${m.codigo} — ${m.nome}` }))}
                placeholder="Máquina"
                allLabel="Todas as máquinas"
                className="w-[220px]"
              />
              <SearchSelect
                value={filtro.gaveta_id}
                onChange={(v) => setFiltro({ ...filtro, gaveta_id: v })}
                options={sortGavetas(gavetaOptions).map((g) => ({ value: g.id, label: g.codigo }))}
                placeholder="Gaveta"
                allLabel="Todas as gavetas"
                className="w-[200px]"
              />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">{tituloRelatorio}</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <ProductsTable produtos={filtered} setores={setores} maquinas={maquinas} gavetas={gavetas} showStatus={false} />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="entradas" className="space-y-6 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-green-600" />
              Movimentações ({movimentacoesFiltradas.length})
            </h3>
            <div className="flex gap-2">
              <Button onClick={handleMovPDF} variant="outline" disabled={movimentacoesFiltradas.length === 0}>
                <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
              </Button>
              <Button onClick={handleMovCSV} disabled={movimentacoesFiltradas.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
              </Button>
            </div>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <span className="text-sm font-semibold text-muted-foreground">Filtrar:</span>
              <Select value={filtroMov.tipo} onValueChange={(v) => setFiltroMov({ ...filtroMov, tipo: v })}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                  <SelectItem value="estorno">Estornos</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[240px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={filtroMov.busca}
                  onChange={(e) => setFiltroMov({ ...filtroMov, busca: e.target.value })}
                  placeholder="Buscar por NF, fornecedor, chave, produto…"
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : movimentacoesFiltradas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma movimentação encontrada.</p>
            ) : (
              <div className="rounded-lg border overflow-auto scrollbar-thin max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                       <TableHead>Data/Hora</TableHead>
                       <TableHead>Tipo</TableHead>
                       <TableHead>Produto</TableHead>
                       <TableHead className="text-right">Quantidade</TableHead>
                       <TableHead>Código</TableHead>
                       <TableHead>Número NF</TableHead>
                       <TableHead>Fornecedor</TableHead>
                       <TableHead>Chave de Acesso</TableHead>
                       <TableHead>Setor</TableHead>
                       <TableHead>Máquina</TableHead>
                       <TableHead>Gaveta</TableHead>
                       <TableHead>Observação</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoesFiltradas.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {m.data ? new Date(m.data).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {m.tipo === 'entrada' ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 w-fit">
                                <ArrowDownCircle className="w-3 h-3" /> Entrada
                              </Badge>
                            ) : m.tipo === 'saida' ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 w-fit">
                                <ArrowUpCircle className="w-3 h-3" /> Saída
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 w-fit">
                                <Undo2 className="w-3 h-3" /> Estorno
                              </Badge>
                            )}
                            {m.estornada === true && (
                              <span className="text-[10px] text-amber-600 font-medium">estornada</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{m.nome_produto || '—'}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {formatQtd(m.quantidade || 0)}{' '}
                          <span className="text-xs text-muted-foreground font-normal">{produtos.find((p) => p.id === m.produto_id)?.unidade || ''}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.codigo || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{m.numero_nf || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{m.fornecedor || '—'}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate">{m.chave_acesso || '—'}</TableCell>
                        <TableCell className="text-sm">{getNome(m.setor_id, setores)}</TableCell>
                        <TableCell className="text-sm">{getNome(m.maquina_id, maquinas)}</TableCell>
                        <TableCell className="text-sm">{getNome(m.gaveta_id, gavetas, 'codigo')}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{m.observacao || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="validade" className="space-y-6 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-muted-foreground">Filtrar:</span>
              <Select value={filtroValidade.setor_id} onValueChange={(v) => setFiltroValidade({ ...filtroValidade, setor_id: v })}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroValidade.faixa} onValueChange={(v) => setFiltroValidade({ ...filtroValidade, faixa: v })}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Validade" /></SelectTrigger>
                <SelectContent>
                  {FAIXAS_VALIDADE.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{lotesValidade.length} lote(s)</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleValidadePDF} variant="outline" disabled={lotesValidade.length === 0}>
                <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
              </Button>
              <Button onClick={handleValidadeCSV} disabled={lotesValidade.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
              </Button>
            </div>
          </div>

          <Card className="p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : lotesValidade.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lote encontrado.</p>
            ) : (
              <div className="rounded-lg border overflow-auto scrollbar-thin max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Gaveta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotesValidade.map((l) => {
                      const produto = produtos.find((p) => p.id === l.produto_id);
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium text-sm">{produto?.nome || '—'}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatQtd(l.quantidade || 0)} {l.unidade}</TableCell>
                          <TableCell className="font-mono text-xs">{l.codigo_lote}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{l.data_validade ? new Date(l.data_validade).toLocaleDateString('pt-BR') : '—'}</TableCell>
                          <TableCell><ValidadeBadge dataValidade={l.data_validade} /></TableCell>
                          <TableCell className="text-sm">{getNome(l.setor_id, setores)}</TableCell>
                          <TableCell className="text-sm">{getNome(l.maquina_id, maquinas)}</TableCell>
                          <TableCell className="text-sm">{getNome(l.gaveta_id, gavetas, 'codigo')}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}