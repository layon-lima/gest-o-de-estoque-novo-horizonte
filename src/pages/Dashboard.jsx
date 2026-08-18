import { useState, useEffect, useMemo } from 'react';
import { Package, Boxes, AlertTriangle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import FilterBar from '@/components/FilterBar';
import StatCard from '@/components/StatCard';
import AlertsPanel from '@/components/AlertsPanel';
import ProductsTable from '@/components/ProductsTable';
import SearchBar from '@/components/SearchBar';
import { filterProdutos } from '@/lib/estoqueFilters';

export default function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ setor_id: '', estoque: '', maquina_id: '', gaveta_id: '' });
  const [busca, setBusca] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
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
    const porFiltros = filterProdutos(produtos, filtros);
    if (!busca.trim()) return porFiltros;
    const termo = busca.toLowerCase().trim();
    return porFiltros.filter(
      (p) =>
        (p.nome || '').toLowerCase().includes(termo) ||
        (p.codigo || '').toLowerCase().includes(termo)
    );
  }, [produtos, filtros, busca]);

  const nonZeroAll = produtos.filter((p) => (p.quantidade || 0) > 0);
  const avgAll = nonZeroAll.reduce((s, p) => s + (p.quantidade || 0), 0) / (nonZeroAll.length || 1);
  const zeradoCount = produtos.filter((p) => (p.quantidade || 0) === 0).length;
  const baixoCount = nonZeroAll.filter((p) => (p.quantidade || 0) < avgAll).length;

  const totalQuantidade = filtered.reduce((s, p) => s + (p.quantidade || 0), 0);

  if (loading)
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Painel de Estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do estoque agrícola</p>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar value={busca} onChange={setBusca} />
        <div className="flex items-center gap-2 flex-wrap">
          <FilterBar filtros={filtros} setFiltros={setFiltros} setores={setores} maquinas={maquinas} gavetas={gavetas} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} title="Produtos" value={filtered.length} colorClass="bg-primary/10 text-primary" />
        <StatCard icon={Boxes} title="Itens em Estoque" value={totalQuantidade} colorClass="bg-blue-100 text-blue-600" />
        <StatCard icon={AlertTriangle} title="Estoque Baixo" value={baixoCount} subtitle="atenção à reposição" colorClass="bg-amber-100 text-amber-600" />
        <StatCard icon={AlertCircle} title="Estoque Zerado" value={zeradoCount} subtitle="reposição crítica" colorClass="bg-red-100 text-red-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Produtos Filtrados</h3>
            <ProductsTable produtos={filtered} setores={setores} maquinas={maquinas} gavetas={gavetas} />
          </Card>
        </div>
        <AlertsPanel baixoCount={baixoCount} zeradoCount={zeradoCount} />
      </div>
    </div>
  );
}