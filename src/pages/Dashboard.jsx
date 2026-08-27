import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import FilterBar from '@/components/FilterBar';
import ProductsTable from '@/components/ProductsTable';
import SearchBar from '@/components/SearchBar';
import { useEntidades } from '@/lib/useEntidades';
import { filterProdutos, matchTerm } from '@/lib/estoqueFilters';

export default function Dashboard() {
  const [filtros, setFiltros] = useState({ setor_id: [], estoque: '', deposito_id: [], maquina_id: [], gaveta_id: [] });
  const [busca, setBusca] = useState('');

  const { data, loading } = useEntidades({
    Produto: {}, Setor: {}, Maquina: {}, Gaveta: {}, Deposito: {}, Lote: {}, SaldoEstoque: {},
  });
  const { Produto: produtos, Setor: setores, Maquina: maquinas, Gaveta: gavetas, Deposito: depositos, Lote: lotes, SaldoEstoque: saldos } = data;

  const filtered = useMemo(() => {
    const porFiltros = filterProdutos(produtos, filtros, saldos);
    if (!busca.trim()) return porFiltros;
    const termos = busca.split(',').map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (termos.length === 0) return porFiltros;
    return porFiltros.filter((p) =>
      termos.every((termo) => matchTerm(p, termo, maquinas, gavetas, depositos, saldos))
    );
  }, [produtos, filtros, busca, maquinas, gavetas, depositos, saldos]);



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
        <SearchBar value={busca} onChange={setBusca} produtos={produtos} maquinas={maquinas} gavetas={gavetas} depositos={depositos} saldos={saldos} />
        <div className="flex items-center gap-2 flex-wrap">
          <FilterBar filtros={filtros} setFiltros={setFiltros} setores={setores} maquinas={maquinas} gavetas={gavetas} depositos={depositos} />
        </div>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Produtos Filtrados</h3>
        <ProductsTable produtos={filtered} setores={setores} maquinas={maquinas} gavetas={gavetas} depositos={depositos} />
      </Card>
    </div>
  );
}