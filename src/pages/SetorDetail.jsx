import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatQtd } from '@/lib/format';
import SetorMovimentacaoForm from '@/components/setores/SetorMovimentacaoForm';

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
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  async function load() {
    setLoading(true);
    const [s, p, m, g, l, movs, ps] = await Promise.all([
      base44.entities.Setor.list(),
      base44.entities.Produto.list(),
      base44.entities.Maquina.list(),
      base44.entities.Gaveta.list(),
      base44.entities.Lote.list(),
      base44.entities.Movimentacao.list('-data', 100),
      base44.entities.Pessoa.list('-created_date', 500),
    ]);
    setSetores(s); setProdutos(p); setMaquinas(m); setGavetas(g); setLotes(l); setMovimentacoes(movs); setPessoas(ps);
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
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto pb-24">
      <header className="flex items-center gap-2">
        <div className="w-3 h-8 rounded-full" style={{ backgroundColor: setor.cor || '#16a34a' }} />
        <div>
          <h1 className="text-xl font-bold leading-tight">{setor.nome}</h1>
          {setor.controla_validade && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Controla validade</Badge>
          )}
        </div>
      </header>

      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto do setor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-thin">
          {produtosSetor.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>
          ) : (
            produtosSetor.map((p) => {
              const gav = gavetas.find((g) => g.id === p.gaveta_id);
              const maq = maquinas.find((m) => m.id === p.maquina_id);
              const baixo = (p.estoque_minimo || 0) > 0 && (p.quantidade || 0) <= (p.estoque_minimo || 0);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{p.nome}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {p.codigo}{gav ? ` · Gav ${gav.codigo}` : ''}{maq ? ` · ${maq.nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold tabular-nums text-sm ${baixo ? 'text-destructive' : ''}`}>{formatQtd(p.quantidade || 0)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.unidade || ''}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <SetorMovimentacaoForm
        setor={setor}
        produtos={produtos}
        maquinas={maquinas}
        gavetas={gavetas}
        lotes={lotes}
        movimentacoes={movimentacoes}
        pessoas={pessoas}
        onSaved={load}
      />
    </div>
  );
}