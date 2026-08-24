import { useState, useEffect, useMemo } from 'react';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import ProductForm from '@/components/ProductForm';
import ProductsTable from '@/components/ProductsTable';
import SearchBar from '@/components/SearchBar';
import FilterBar from '@/components/FilterBar';
import { filterProdutos, matchTerm } from '@/lib/estoqueFilters';
import { useToast } from '@/components/ui/use-toast';

export default function ProdutosManager() {
  const [produtos, setProdutos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filtros, setFiltros] = useState({ setor_id: '', estoque: '', maquina_id: '', gaveta_id: '' });
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const [p, s, dep, m, g] = await Promise.all([
      base44.entities.Produto.list(),
      base44.entities.Setor.list(),
      base44.entities.Deposito.list(),
      base44.entities.Maquina.list(),
      base44.entities.Gaveta.list(),
    ]);
    setProdutos(p); setSetores(s); setDepositos(dep); setMaquinas(m); setGavetas(g);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const porFiltros = filterProdutos(produtos, filtros);
    if (!busca.trim()) return porFiltros;
    const termos = busca.split(',').map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (termos.length === 0) return porFiltros;
    return porFiltros.filter((p) => termos.every((termo) => matchTerm(p, termo, maquinas, gavetas)));
  }, [produtos, filtros, busca, maquinas, gavetas]);

  function handleNew() { setEditing(null); setFormOpen(true); }
  function handleEdit(produto) { setEditing(produto); setFormOpen(true); }

  async function handleDelete(produto) {
    await base44.entities.Produto.delete(produto.id);
    toast({ title: 'Produto excluído' });
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Produtos</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie todos os produtos do estoque</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo Produto
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : produtos.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum produto cadastrado ainda.</p>
          <Button onClick={handleNew} className="mx-auto">
            <Plus className="w-4 h-4 mr-2" /> Adicionar primeiro produto
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar value={busca} onChange={setBusca} produtos={produtos} maquinas={maquinas} gavetas={gavetas} />
            <div className="flex items-center gap-2 flex-wrap">
              <FilterBar filtros={filtros} setFiltros={setFiltros} setores={setores} maquinas={maquinas} gavetas={gavetas} />
            </div>
          </div>

          <Card className="p-5">
            <ProductsTable
              produtos={filtered}
              setores={setores}
              maquinas={maquinas}
              gavetas={gavetas}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </Card>
        </>
      )}

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        produto={editing}
        setores={setores}
        depositos={depositos}
        maquinas={maquinas}
        gavetas={gavetas}
        onSaved={load}
        produtos={produtos}
      />
    </div>
  );
}