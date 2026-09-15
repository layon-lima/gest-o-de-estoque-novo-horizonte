import { useState, useMemo } from 'react';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import ProductForm from '@/components/ProductForm';
import ProductsTable from '@/components/ProductsTable';
import SearchBar from '@/components/SearchBar';
import FilterBar from '@/components/FilterBar';
import { matchTerm } from '@/lib/estoqueFilters';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import { safeDelete } from '@/lib/entityOps';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export default function ProdutosManager() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filtros, setFiltros] = useState({ setor_id: [], estoque: '', deposito_id: [], maquina_id: [], gaveta_id: [] });
  const [busca, setBusca] = useState('');
  const [excluirProduto, setExcluirProduto] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const { toast } = useToast();

  const { data, loading, reload: load } = useEntidades({
    Produto: {}, Setor: {}, Deposito: {}, Maquina: {}, Gaveta: {}, SaldoEstoque: {},
  });
  const { Produto: produtos, Setor: setores, Deposito: depositos, Maquina: maquinas, Gaveta: gavetas, SaldoEstoque: saldos } = data;

  // Aba de cadastro: lista TODOS os produtos da base, tenham estoque ou não,
  // filtrando apenas pelos atributos cadastrais (não por saldo/parcela SAP).
  const filtered = useMemo(() => {
    const asArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const setorFilter = asArr(filtros.setor_id);
    const depFilter = asArr(filtros.deposito_id);
    const maqFilter = asArr(filtros.maquina_id);
    const gavFilter = asArr(filtros.gaveta_id);
    let result = produtos.map((p) => ({ ...p, _rowKey: p.id }));
    if (setorFilter.length) result = result.filter((p) => setorFilter.includes(p.setor_id));
    if (depFilter.length) result = result.filter((p) => depFilter.includes(p.deposito_id));
    if (maqFilter.length) result = result.filter((p) => maqFilter.includes(p.maquina_id));
    if (gavFilter.length) result = result.filter((p) => gavFilter.includes(p.gaveta_id));
    if (!busca.trim()) return result;
    const termos = busca.split(',').map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (termos.length === 0) return result;
    return result.filter((p) => termos.every((termo) => matchTerm(p, termo, maquinas, gavetas, depositos, saldos)));
  }, [produtos, filtros, busca, maquinas, gavetas, depositos, saldos]);

  function handleNew() { setEditing(null); setFormOpen(true); }
  function handleEdit(produto) { setEditing(produto); setFormOpen(true); }

  function handleDelete(produto) { setExcluirProduto(produto); }
  async function confirmarExclusao() {
    if (!excluirProduto) return;
    setExcluindo(true);
    try {
      await safeDelete('Produto', excluirProduto.id);
      toast({ title: 'Produto excluído' });
      setExcluirProduto(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: String(err?.message || err) });
    } finally {
      setExcluindo(false);
    }
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
            <SearchBar value={busca} onChange={setBusca} produtos={produtos} maquinas={maquinas} gavetas={gavetas} depositos={depositos} saldos={saldos} />
            <div className="flex items-center gap-2 flex-wrap">
              <FilterBar filtros={filtros} setFiltros={setFiltros} setores={setores} maquinas={maquinas} gavetas={gavetas} depositos={depositos} />
            </div>
          </div>

          <Card className="p-5">
            <ProductsTable
              produtos={filtered}
              setores={setores}
              maquinas={maquinas}
              gavetas={gavetas}
              depositos={depositos}
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

      <AlertDialog open={!!excluirProduto} onOpenChange={(o) => !o && !excluindo && setExcluirProduto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluirProduto && (
                <>Tem certeza que deseja excluir o produto <b>{excluirProduto.nome}</b> ({excluirProduto.codigo || 'sem código'})? Esta ação não pode ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={excluindo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}