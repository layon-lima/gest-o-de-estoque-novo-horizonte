import { useState, useEffect, useMemo } from 'react';
import { FileDown, FileSpreadsheet, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { getNome } from '@/lib/estoqueFilters';
import { filterLotesByFaixa, FAIXAS_VALIDADE } from '@/lib/lotes';
import ValidadeBadge from '@/components/ValidadeBadge';
import { exportPDF, exportCSV } from '@/lib/exports';

export default function Lotes() {
  const [lotes, setLotes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroSetor, setFiltroSetor] = useState('all');
  const [filtroFaixa, setFiltroFaixa] = useState('all');

  useEffect(() => {
    async function load() {
      const [l, p, s, m, g] = await Promise.all([
        base44.entities.Lote.list(),
        base44.entities.Produto.list(),
        base44.entities.Setor.list(),
        base44.entities.Maquina.list(),
        base44.entities.Gaveta.list(),
      ]);
      setLotes(l); setProdutos(p); setSetores(s); setMaquinas(m); setGavetas(g);
      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();
  const lotesComSaldo = useMemo(() => lotes.filter((l) => (l.quantidade || 0) > 0), [lotes]);

  const filtered = useMemo(() => {
    let r = lotesComSaldo;
    if (filtroSetor !== 'all') r = r.filter((l) => l.setor_id === filtroSetor);
    r = filterLotesByFaixa(r, filtroFaixa, now);
    return [...r].sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
  }, [lotesComSaldo, filtroSetor, filtroFaixa]);

  function buildRows() {
    return filtered.map((l) => {
      const produto = produtos.find((p) => p.id === l.produto_id);
      return [
        produto?.nome || '—',
        l.codigo_lote || '',
        l.data_validade ? new Date(l.data_validade).toLocaleDateString('pt-BR') : '—',
        getNome(l.setor_id, setores),
        getNome(l.maquina_id, maquinas),
        getNome(l.gaveta_id, gavetas, 'codigo'),
        l.quantidade || 0,
        l.unidade || '',
      ];
    });
  }

  function handlePDF() {
    exportPDF('Relatório de Lotes e Validade', ['Produto', 'Lote', 'Validade', 'Setor', 'Máquina', 'Gaveta', 'Quantidade', 'Unidade'], buildRows());
  }
  function handleCSV() {
    exportCSV('Relatório de Lotes e Validade', ['Produto', 'Lote', 'Validade', 'Setor', 'Máquina', 'Gaveta', 'Quantidade', 'Unidade'], buildRows());
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="w-6 h-6 text-primary" /> Lotes e Validade
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de lotes por validade (FEFO)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePDF} variant="outline" disabled={filtered.length === 0}>
            <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
          </Button>
          <Button onClick={handleCSV} disabled={filtered.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
          </Button>
        </div>
      </header>

      <Card className="p-5">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <span className="text-sm font-semibold text-muted-foreground">Filtrar:</span>
          <Select value={filtroSetor} onValueChange={setFiltroSetor}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroFaixa} onValueChange={setFiltroFaixa}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Validade" /></SelectTrigger>
            <SelectContent>
              {FAIXAS_VALIDADE.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} lote(s)</span>
        </div>
      </Card>

      <Card className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lote encontrado para o filtro selecionado.</p>
        ) : (
          <div className="rounded-lg border overflow-auto scrollbar-thin max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Gaveta</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const produto = produtos.find((p) => p.id === l.produto_id);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium text-sm">{produto?.nome || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{l.codigo_lote}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {l.data_validade ? new Date(l.data_validade).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell><ValidadeBadge dataValidade={l.data_validade} now={now} /></TableCell>
                      <TableCell className="text-sm">{getNome(l.setor_id, setores)}</TableCell>
                      <TableCell className="text-sm">{getNome(l.maquina_id, maquinas)}</TableCell>
                      <TableCell className="text-sm">{getNome(l.gaveta_id, gavetas, 'codigo')}</TableCell>
                      <TableCell className="text-right font-semibold">{l.quantidade} {l.unidade}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}