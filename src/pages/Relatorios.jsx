import { useState, useEffect, useMemo } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  useEffect(() => {
    async function load() {
      const [p, s, m, g] = await Promise.all([
        base44.entities.Produto.list(),
        base44.entities.Setor.list(),
        base44.entities.Maquina.list(),
        base44.entities.Gaveta.list(),
      ]);
      setProdutos(p); setSetores(s); setMaquinas(m); setGavetas(g);
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

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Exporte relatórios de estoque em PDF ou Excel</p>
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
    </div>
  );
}