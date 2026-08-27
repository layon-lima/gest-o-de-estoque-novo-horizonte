import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ArrowDownToLine, ArrowUpFromLine, ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { useEntidades } from '@/lib/useEntidades';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useBackHandler } from '@/hooks/useBackHandler';
import { readUiState, writeUiState } from '@/lib/uiStateStore';
import SetorMovimentacaoForm from '@/components/setores/SetorMovimentacaoForm';
import SetorProdutoRow from '@/components/setores/SetorProdutoRow';
import InventarioConference from '@/components/inventario/InventarioConference';

export default function SetorDetail() {
  const { setorId } = useParams();
  const { user } = useAuth();
  const [busca, setBusca] = usePersistentState(`setor:busca:${setorId}`, '');
  const [expandedId, setExpandedId] = usePersistentState(`setor:exp:${setorId}`, null);
  const [modalTipo, setModalTipo] = useState(null);
  const [inventarioOpen, setInventarioOpen] = usePersistentState(`setor:inv:open:${setorId}`, false);
  const [inventarioId, setInventarioId] = usePersistentState(`setor:inv:id:${setorId}`, null);
  const listRef = useRef(null);

  const { data, loading, reload: load } = useEntidades({
    Setor: {},
    Produto: {},
    Maquina: {},
    Gaveta: {},
    Lote: {},
    SaldoEstoque: {},
    Movimentacao: { sort: '-data', limit: 100 },
    Pessoa: { sort: '-created_date', limit: 500 },
    Deposito: {},
  });
  const {
    Setor: setores, Produto: produtos, Maquina: maquinas, Gaveta: gavetas, Lote: lotes,
    SaldoEstoque: saldos, Movimentacao: movimentacoes, Pessoa: pessoas, Deposito: depositos,
  } = data;

  // Voltar do sistema (mobile) ponto a ponto: recolhe produto → fecha modal → fecha inventário.
  useBackHandler(!!expandedId, () => setExpandedId(null));
  useBackHandler(!!modalTipo, () => setModalTipo(null));
  useBackHandler(inventarioOpen, () => setInventarioOpen(false));

  // Preserva a posição de scroll da lista ao sair/retornar da rota (mobile).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const saved = readUiState(`setor:scroll:${setorId}`);
    if (saved) el.scrollTop = saved;
    return () => writeUiState(`setor:scroll:${setorId}`, el.scrollTop);
  }, [setorId, loading]);

  const setor = useMemo(() => setores.find((s) => s.id === setorId), [setores, setorId]);

  const podeVer = useMemo(() => {
    if (!user || !setor) return false;
    if (setor.tem_aba_mobile !== true) return false;
    if (user.role === 'admin') return true;
    const permitidos = Array.isArray(user.setores_permitidos) ? user.setores_permitidos : [];
    return permitidos.includes(setor.id);
  }, [user, setor]);

  const produtosSetor = useMemo(() => {
    if (!setor) return [];
    const q = busca.toLowerCase().trim();
    return produtos
      .filter((p) => p.setor_id === setor.id)
      .filter((p) =>
        !q ||
        (p.nome || '').toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q) ||
        (p.codigo_referencia || '').toLowerCase().includes(q)
      );
  }, [produtos, setor, busca]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  if (!setor || !podeVer) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">Setor indisponível</h1>
        <p className="text-sm text-muted-foreground">Você não tem acesso a este setor.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-40">
      <header className="flex items-center gap-2">
        <div className="w-3 h-8 rounded-full" style={{ backgroundColor: setor.cor || '#16a34a' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight truncate">{setor.nome}</h1>
          {setor.controla_validade && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Controla validade</Badge>
          )}
        </div>
        {setor.permite_inventario && (
          <Button variant="outline" size="sm" className="md:hidden gap-1.5 shrink-0" onClick={() => setInventarioOpen(true)}>
            <ClipboardList className="w-4 h-4" />
            Inventário
          </Button>
        )}
        {inventarioOpen && (
          <Button variant="ghost" size="sm" className="md:hidden gap-1.5 shrink-0 text-destructive" onClick={() => setInventarioOpen(false)}>
            Fechar
          </Button>
        )}
      </header>

      {/* Busca em destaque */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          className="pl-11 h-12 text-base rounded-xl shadow-sm"
          placeholder="Buscar produto por nome ou código…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Card className="p-2 sm:p-3">
        <div ref={listRef} className="space-y-1 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {produtosSetor.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum produto encontrado.</p>
          ) : (
            produtosSetor.map((p) => (
              <SetorProdutoRow
                key={p.id}
                produto={p}
                gavetas={gavetas}
                maquinas={maquinas}
                depositos={depositos}
                lotes={lotes}
                saldos={saldos}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              />
            ))
          )}
        </div>
      </Card>

      {/* Barra de ações fixa: Entrada / Saída */}
      <div className="fixed bottom-0 inset-x-0 z-20 md:hidden pb-safe" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.25rem)' }}>
        <div className="mx-auto max-w-3xl px-4">
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="h-12 rounded-xl text-base" onClick={() => setModalTipo('entrada')}>
              <ArrowDownToLine className="w-5 h-5 mr-2" />
              Entrada
            </Button>
            <Button size="lg" variant="destructive" className="h-12 rounded-xl text-base" onClick={() => setModalTipo('saida')}>
              <ArrowUpFromLine className="w-5 h-5 mr-2" />
              Saída
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!modalTipo} onOpenChange={(o) => !o && setModalTipo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modalTipo === 'entrada' ? 'Entrada de estoque' : 'Saída de estoque'}
            </DialogTitle>
          </DialogHeader>
          <SetorMovimentacaoForm
            setor={setor}
            produtos={produtos}
            maquinas={maquinas}
            gavetas={gavetas}
            depositos={depositos}
            lotes={lotes}
            saldos={saldos}
            movimentacoes={movimentacoes}
            pessoas={pessoas}
            onSaved={load}
            onClose={() => setModalTipo(null)}
            tipoForcado={modalTipo}
          />
        </DialogContent>
      </Dialog>

      <InventarioConference
        open={inventarioOpen}
        onOpenChange={(o) => { setInventarioOpen(o); if (!o) setInventarioId(null); }}
        setor={setor}
        produtos={produtos}
        depositos={depositos}
        maquinas={maquinas}
        gavetas={gavetas}
        lotes={lotes}
        user={user}
        onSaved={load}
        initialInventarioId={inventarioId}
        onInventarioAberto={setInventarioId}
      />
    </div>
  );
}