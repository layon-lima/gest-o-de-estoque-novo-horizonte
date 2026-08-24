import { useState, useEffect, useMemo } from 'react';
import { Layers, ArrowLeft, Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatQtd } from '@/lib/format';
import SetorMovimentacaoForm from '@/components/setores/SetorMovimentacaoForm';

export default function Setores() {
  const { user } = useAuth();
  const [setores, setSetores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setorAtivo, setSetorAtivo] = useState(null);
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

  const setoresVisiveis = useMemo(() => {
    const ativos = setores.filter((s) => s.tem_aba_mobile === true);
    if (!user) return [];
    if (user.role === 'admin') return ativos;
    const permitidos = Array.isArray(user.setores_permitidos) ? user.setores_permitidos : [];
    if (permitidos.length === 0) return [];
    return ativos.filter((s) => permitidos.includes(s.id));
  }, [setores, user]);

  useEffect(() => {
    if (setoresVisiveis.length === 1 && !setorAtivo) setSetorAtivo(setoresVisiveis[0]);
  }, [setoresVisiveis, setorAtivo]);

  const produtosSetor = useMemo(() => {
    if (!setorAtivo) return [];
    const q = busca.toLowerCase().trim();
    return produtos
      .filter((p) => p.setor_id === setorAtivo.id)
      .filter((p) =>
        !q ||
        (p.nome || '').toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q) ||
        (p.codigo_referencia || '').toLowerCase().includes(q)
      );
  }, [produtos, setorAtivo, busca]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  if (setoresVisiveis.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="w-6 h-6 text-primary" /> Setores</h1>
        </header>
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Você não possui setores liberados para a aba mobile.
        </Card>
      </div>
    );
  }

  if (!setorAtivo) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="w-6 h-6 text-primary" /> Setores</h1>
          <p className="text-sm text-muted-foreground mt-1">Escolha um setor para operar</p>
        </header>
        <div className="space-y-3">
          {setoresVisiveis.map((s) => {
            const count = produtos.filter((p) => p.setor_id === s.id).length;
            return (
              <button key={s.id} type="button" onClick={() => setSetorAtivo(s)} className="w-full text-left">
                <Card className="p-4 flex items-center gap-4 hover:shadow-md hover:border-primary/50 transition-all">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (s.cor || '#16a34a') + '22' }}>
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: s.cor || '#16a34a' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{s.nome}</p>
                    <p className="text-xs text-muted-foreground">{count} produto(s) cadastrado(s)</p>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto pb-24">
      <header className="flex items-center gap-3">
        {setoresVisiveis.length > 1 && (
          <button type="button" onClick={() => setSetorAtivo(null)} className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: setorAtivo.cor || '#16a34a' }} />
          <div>
            <h1 className="text-xl font-bold leading-tight">{setorAtivo.nome}</h1>
            {setorAtivo.controla_validade && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Controla validade</Badge>
            )}
          </div>
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
        setor={setorAtivo}
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