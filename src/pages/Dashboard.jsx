import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import FilterBar from '@/components/FilterBar';
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

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Produtos Filtrados</h3>
        <ProductsTable produtos={filtered} setores={setores} maquinas={maquinas} gavetas={gavetas} />
      </Card>
    </div>
  );
}