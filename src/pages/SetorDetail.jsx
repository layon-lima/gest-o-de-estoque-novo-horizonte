import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Package, ArrowDownToLine, ArrowUpFromLine, ClipboardList } from 'lucide-react';
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
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatQtd } from '@/lib/format';
import SetorMovimentacaoForm from '@/components/setores/SetorMovimentacaoForm';
import InventarioConference from '@/components/inventario/InventarioConference';

export default function SetorDetail() {
  const { setorId } = useParams();
  const { user } = useAuth();
  const [setores, setSetores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalTipo, setModalTipo] = useState(null);
  const [inventarioOpen, setInventarioOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [s, p, m, g, l, movs, ps, d] = await Promise.all([
      base44.entities.Setor.list(),
      base44.entities.Produto.list(),
      base44.entities.Maquina.list(),
      base44.entities.Gaveta.list(),
      base44.entities.Lote.list(),
      base44.entities.Movimentacao.list('-data', 100),
      base44.entities.Pessoa.list('-created_date', 500),
      base44.entities.Deposito.list(),
    ]);
    setSetores(s); setProdutos(p); setMaquinas(m); setGavetas(g); setLotes(l); setMovimentacoes(movs); setPessoas(ps); setDepositos(d);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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
      </header>

      {/* Busca em destaque */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          autoFocus
          className="pl-11 h-12 text-base rounded-xl shadow-sm"
          placeholder="Buscar produto por nome ou código…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Card className="p-2 sm:p-3">
        <div className="space-y-1 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {produtosSetor.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum produto encontrado.</p>
          ) : (
            produtosSetor.map((p) => {
              const gav = gavetas.find((g) => g.id === p.gaveta_id);
              const maq = maquinas.find((m) => m.id === p.maquina_id);
              const baixo = (p.estoque_minimo || 0) > 0 && (p.quantidade || 0) <= (p.estoque_minimo || 0);
              return (
                <button
                  key={p.id}
                  onClick={() => setModalTipo('saida')}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/60 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{p.nome}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {p.codigo}{gav ? ` · Gav ${gav.codigo}` : ''}{maq ? ` · ${maq.nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold tabular-nums text-sm ${baixo ? 'text-destructive' : ''}`}>{formatQtd(p.quantidade || 0)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.unidade || ''}</p>
                  </div>
                </button>
              );
            })
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
            lotes={lotes}
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
        onOpenChange={setInventarioOpen}
        setor={setor}
        produtos={produtos}
        depositos={depositos}
        maquinas={maquinas}
        gavetas={gavetas}
        lotes={lotes}
        user={user}
        onSaved={load}
      />
    </div>
  );
}