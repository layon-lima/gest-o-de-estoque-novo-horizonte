import { useState, useEffect, useMemo } from 'react';
import { FileDown, FileSpreadsheet, ArrowDownCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { base44 } from '@/api/base44Client';
import ProductsTable from '@/components/ProductsTable';
import { exportPDF, exportCSV } from '@/lib/exports';
import { getNome } from '@/lib/estoqueFilters';

export default function Relatorios() {
  const [produtos, setProdutos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState({ setor_id: 'all', maquina_id: 'all', gaveta_id: 'all' });
  const [movimentacoes, setMovimentacoes] = useState([]);

  useEffect(() => {
    async function load() {
      const [p, s, m, g, movs] = await Promise.all([
        base44.entities.Produto.list(),
        base44.entities.Setor.list(),
        base44.entities.Maquina.list(),
        base44.entities.Gaveta.list(),
        base44.entities.Movimentacao.list('-data', 200),
      ]);
      setProdutos(p); setSetores(s); setMaquinas(m); setGavetas(g); setMovimentacoes(movs);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      if (filtro.setor_id !== 'all' && p.setor_id !== filtro.setor_id) return false;
      if (filtro.maquina_id !== 'all' && p.maquina_id !== filtro.maquina_id) return false;
      if (filtro.gaveta_id !== 'all' && p.gaveta_id !== filtro.gaveta_id) return false;
      return true;
    });
  }, [produtos, filtro]);

  function buildRows() {
    return filtered.map((p) => {
      const qtd = p.quantidade || 0;
      const st = qtd === 0 ? 'Zerado' : 'Normal';
      return [
        p.nome,
        p.codigo,
        getNome(p.setor_id, setores),
        getNome(p.maquina_id, maquinas),
        getNome(p.gaveta_id, gavetas, 'codigo'),
        qtd,
        p.unidade || '',
        st,
      ];
    });
  }

  function handlePDF() {
    const cols = ['Produto', 'Código', 'Setor', 'Máquina', 'Gaveta', 'Quantidade', 'Unidade', 'Status'];
    exportPDF('Relatório de Estoque', cols, buildRows());
  }

  function handleCSV() {
    const cols = ['Produto', 'Código', 'Setor', 'Máquina', 'Gaveta', 'Quantidade', 'Unidade', 'Status'];
    exportCSV('Relatório de Estoque', cols, buildRows());
  }

  const setorNome = filtro.setor_id !== 'all' ? getNome(filtro.setor_id, setores) : 'Todos';
  const tituloRelatorio = `Estoque — ${setorNome} (${filtered.length} itens)`;

  const entradasRecentes = useMemo(() => {
    return movimentacoes.filter((m) => m.tipo === 'entrada');
  }, [movimentacoes]);

  function buildEntradasRows() {
    return entradasRecentes.map((m) => [
      m.data ? new Date(m.data).toLocaleString('pt-BR') : '',
      m.nome_produto || '',
      m.codigo || '',
      getNome(m.setor_id, setores),
      getNome(m.maquina_id, maquinas),
      getNome(m.gaveta_id, gavetas, 'codigo'),
      m.quantidade || 0,
      m.observacao || '',
    ]);
  }

  function handleEntradasPDF() {
    const cols = ['Data/Hora', 'Produto', 'Código', 'Setor', 'Máquina', 'Gaveta', 'Quantidade', 'Observação'];
    exportPDF('Relatório de Entradas Recentes', cols, buildEntradasRows());
  }

  function handleEntradasCSV() {
    const cols = ['Data/Hora', 'Produto', 'Código', 'Setor', 'Máquina', 'Gaveta', 'Quantidade', 'Observação'];
    exportCSV('Relatório de Entradas Recentes', cols, buildEntradasRows());
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
          <TabsTrigger value="entradas">Entradas Recentes</TabsTrigger>
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
                  {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtro.maquina_id} onValueChange={(v) => setFiltro({ ...filtro, maquina_id: v })}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Máquina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as máquinas</SelectItem>
                  {maquinas.map((m) => <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtro.gaveta_id} onValueChange={(v) => setFiltro({ ...filtro, gaveta_id: v })}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Gaveta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as gavetas</SelectItem>
                  {gavetas.map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>)}
                </SelectContent>
              </Select>
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
              Entradas Recentes ({entradasRecentes.length})
            </h3>
            <div className="flex gap-2">
              <Button onClick={handleEntradasPDF} variant="outline" disabled={entradasRecentes.length === 0}>
                <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
              </Button>
              <Button onClick={handleEntradasCSV} disabled={entradasRecentes.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
              </Button>
            </div>
          </div>

          <Card className="p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : entradasRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma entrada registrada.</p>
            ) : (
              <div className="rounded-lg border overflow-auto scrollbar-thin max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Gaveta</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradasRecentes.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {m.data ? new Date(m.data).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{m.nome_produto || '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.codigo || '—'}</TableCell>
                        <TableCell className="text-sm">{getNome(m.setor_id, setores)}</TableCell>
                        <TableCell className="text-sm">{getNome(m.maquina_id, maquinas)}</TableCell>
                        <TableCell className="text-sm">{getNome(m.gaveta_id, gavetas, 'codigo')}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{m.quantidade}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{m.observacao || '—'}</TableCell>
                      </TableRow>
                    ))}
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