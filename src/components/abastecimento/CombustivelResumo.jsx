import { useMemo } from 'react';
import { Fuel, Droplet, Gauge, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatQtd } from '@/lib/format';
import { setorControlaValidade } from '@/lib/lotes';

// Calcula o saldo disponível de um combustível (considera lotes quando o setor controla validade).
function saldoProduto(produto, lotes, setores) {
  if (!produto) return 0;
  if (setorControlaValidade(produto.setor_id, setores)) {
    return (lotes || [])
      .filter((l) => l.produto_id === produto.id)
      .reduce((s, l) => s + (l.quantidade || 0), 0);
  }
  return produto.quantidade || 0;
}

// Threshold de estoque baixo (relativo ao estoque mínimo do produto, se houver).
function nivelPct(saldo, minimo) {
  const m = Number(minimo) || 0;
  if (m <= 0) return null;
  return Math.min(100, Math.round((saldo / m) * 100));
}

export default function CombustivelResumo({ combustiveis, lotes, setores, loading }) {
  const itens = useMemo(
    () =>
      (combustiveis || []).map((p) => {
        const saldo = saldoProduto(p, lotes, setores);
        return {
          id: p.id,
          nome: p.nome,
          unidade: p.unidade || 'un',
          saldo,
          minimo: p.estoque_minimo || 0,
          pct: nivelPct(saldo, p.estoque_minimo),
        };
      }),
    [combustiveis, lotes, setores]
  );

  const total = useMemo(() => itens.reduce((s, i) => s + i.saldo, 0), [itens]);
  const unidadeBase = itens[0]?.unidade || 'L';
  const baixos = itens.filter((i) => i.minimo > 0 && i.saldo <= i.minimo);

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-16 rounded-lg bg-muted" />
      </Card>
    );
  }

  if (itens.length === 0) {
    return null;
  }

  return (
    <>
      {/* ===== Mobile: card hero, visualmente destacado ===== */}
      <div className="sm:hidden">
        <Card className="overflow-hidden border-amber-200">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide opacity-90">
                <Gauge className="w-3.5 h-3.5" />
                Disponível para abastecer
              </span>
              <Fuel className="w-5 h-5 opacity-90" />
            </div>
            <div className="mt-1.5 flex items-end gap-1.5">
              <span className="text-3xl font-bold leading-none tabular-nums">{formatQtd(total)}</span>
              <span className="text-sm font-medium opacity-90 mb-0.5">{unidadeBase}</span>
            </div>
            <p className="text-[11px] opacity-80 mt-0.5">
              {itens.length} {itens.length === 1 ? 'combustível' : 'combustíveis'} em estoque
            </p>
          </div>

          <div className="p-3 space-y-2.5 bg-card">
            {itens.map((i) => {
              const critico = i.minimo > 0 && i.saldo <= i.minimo;
              const abaixo = i.minimo > 0 && i.saldo <= i.minimo * 1.2;
              return (
                <div key={i.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Droplet className={`w-3.5 h-3.5 shrink-0 ${critico ? 'text-red-500' : abaixo ? 'text-amber-500' : 'text-primary'}`} />
                      <span className="text-sm font-medium truncate">{i.nome}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatQtd(i.saldo)} <span className="text-xs font-normal text-muted-foreground">{i.unidade}</span>
                    </span>
                  </div>
                  {i.pct !== null && (
                    <Progress
                      value={i.pct}
                      className="h-1.5"
                      indicatorClassName={critico ? 'bg-red-500' : abaixo ? 'bg-amber-500' : 'bg-primary'}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {baixos.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 px-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {baixos.length} combustível(eis) abaixo do estoque mínimo.
          </div>
        )}
      </div>

      {/* ===== Desktop: resumo compacto em cards ===== */}
      <div className="hidden sm:grid grid-cols-3 gap-3">
        <Card className="p-4 col-span-1 bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-400">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide opacity-90">
            <Gauge className="w-4 h-4" />
            Total disponível
          </div>
          <div className="mt-2 flex items-end gap-1.5">
            <span className="text-2xl font-bold tabular-nums">{formatQtd(total)}</span>
            <span className="text-sm opacity-90 mb-0.5">{unidadeBase}</span>
          </div>
          <p className="text-xs opacity-80 mt-0.5">{itens.length} combustível(eis) em estoque</p>
        </Card>

        <div className="col-span-2 grid grid-cols-2 gap-3">
          {itens.map((i) => {
            const critico = i.minimo > 0 && i.saldo <= i.minimo;
            const abaixo = i.minimo > 0 && i.saldo <= i.minimo * 1.2;
            return (
              <Card key={i.id} className="p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Droplet className={`w-4 h-4 ${critico ? 'text-red-500' : abaixo ? 'text-amber-500' : 'text-primary'}`} />
                  <span className="text-sm font-medium truncate">{i.nome}</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold tabular-nums">{formatQtd(i.saldo)}</span>
                  <span className="text-xs text-muted-foreground mb-0.5">{i.unidade}</span>
                </div>
                {i.minimo > 0 && (
                  <p className="text-[11px] text-muted-foreground">mínimo: {formatQtd(i.minimo)} {i.unidade}</p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}