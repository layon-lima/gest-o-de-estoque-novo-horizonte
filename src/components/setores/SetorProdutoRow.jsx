import {
  Package,
  ChevronDown,
  AlertTriangle,
  Layers,
  Calendar,
  MapPin,
  Boxes,
} from 'lucide-react';
import { formatQtd } from '@/lib/format';

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

function Detail({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium break-words text-sm">{value}</p>
    </div>
  );
}

function getDepLabel(dep) {
  if (!dep) return '—';
  return dep.nome ? `${dep.numero} · ${dep.nome}` : dep.numero || '—';
}

export default function SetorProdutoRow({
  produto,
  gavetas,
  maquinas,
  depositos,
  lotes,
  saldos,
  expanded,
  onToggle,
}) {
  // Saldo real vem da entidade SaldoEstoque (estilo SAP): uma parcela por
  // depósito/gaveta/lote. O total exibido é a soma dessas parcelas.
  const parcelas = (saldos || [])
    .filter((s) => s.produto_id === produto.id && (s.quantidade || 0) > 0)
    .sort((a, b) => (a.deposito_id || '').localeCompare(b.deposito_id || ''));

  const totalReal =
    parcelas.length > 0
      ? parcelas.reduce((s, p) => s + (p.quantidade || 0), 0)
      : produto.quantidade || 0;

  const baixo =
    (produto.estoque_minimo || 0) > 0 && totalReal <= (produto.estoque_minimo || 0);

  const maq = maquinas.find((m) => m.id === produto.maquina_id);
  const resolveDep = (id) => depositos.find((d) => d.id === id);
  const resolveGav = (id) => gavetas.find((g) => g.id === id);
  const resolveLote = (id) => lotes.find((l) => l.id === id);

  return (
    <div className="rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-2.5 hover:bg-accent/60 text-left transition-colors"
      >
        <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Package className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{produto.nome}</p>
          <p className="text-xs text-muted-foreground font-mono truncate">{produto.codigo}</p>
        </div>
        <div className="text-right shrink-0">
          <p
            className={`font-semibold tabular-nums text-sm ${
              baixo ? 'text-destructive' : ''
            }`}
          >
            {formatQtd(totalReal)}
          </p>
          <p className="text-[10px] text-muted-foreground">{produto.unidade || ''}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 bg-muted/30">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Detail
              label="Estoque atual"
              value={`${formatQtd(totalReal)} ${produto.unidade || ''}`}
            />
            <Detail
              label="Estoque mínimo"
              value={`${formatQtd(produto.estoque_minimo || 0)} ${produto.unidade || ''}`}
            />
            <Detail label="Código ref." value={produto.codigo_referencia || '—'} />
            {maq && <Detail label="Máquina" value={maq.nome} />}
          </div>

          {baixo && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" /> Estoque abaixo do mínimo
            </div>
          )}

          {/* Saldos por localização — reflete o banco de dados (SaldoEstoque) */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Boxes className="w-3 h-3" /> Saldos por localização
            </p>
            {parcelas.length === 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Sem saldo registrado em estoque
              </p>
            ) : (
              parcelas.map((s) => {
                const dep = resolveDep(s.deposito_id);
                const gav = resolveGav(s.gaveta_id);
                const lote = s.lote_id ? resolveLote(s.lote_id) : null;
                return (
                  <div
                    key={s.id}
                    className="rounded-md bg-background/70 border border-border/60 px-2.5 py-2 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{getDepLabel(dep)}</p>
                        {gav && (
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Gaveta {gav.codigo}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold tabular-nums text-sm">
                          {formatQtd(s.quantidade)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.unidade || produto.unidade || ''}
                        </p>
                      </div>
                    </div>
                    {lote && (
                      <div className="flex items-center justify-between text-[11px] bg-amber-50/60 rounded px-1.5 py-1">
                        <span className="flex items-center gap-1 font-mono text-amber-800 truncate">
                          <Layers className="w-3 h-3 shrink-0" /> {lote.codigo_lote}
                        </span>
                        {lote.data_validade && (
                          <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                            <Calendar className="w-3 h-3" /> {formatDate(lote.data_validade)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}