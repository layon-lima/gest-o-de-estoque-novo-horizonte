import {
  Package,
  ChevronDown,
  AlertTriangle,
  Layers,
  Calendar,
  MapPin,
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

export default function SetorProdutoRow({
  produto,
  gavetas,
  maquinas,
  depositos,
  lotes,
  expanded,
  onToggle,
}) {
  const gav = gavetas.find((g) => g.id === produto.gaveta_id);
  const maq = maquinas.find((m) => m.id === produto.maquina_id);
  const dep = depositos.find((d) => d.id === produto.deposito_id);
  const baixo =
    (produto.estoque_minimo || 0) > 0 &&
    (produto.quantidade || 0) <= (produto.estoque_minimo || 0);
  const lotesProd = (lotes || []).filter(
    (l) => l.produto_id === produto.id && (l.quantidade || 0) > 0
  );

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
          <p className="text-xs text-muted-foreground font-mono truncate">
            {produto.codigo}
            {gav ? ` · Gav ${gav.codigo}` : ''}
            {maq ? ` · ${maq.nome}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className={`font-semibold tabular-nums text-sm ${
              baixo ? 'text-destructive' : ''
            }`}
          >
            {formatQtd(produto.quantidade || 0)}
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
        <div className="px-3 pb-3 pt-1 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Detail
              label="Estoque atual"
              value={`${formatQtd(produto.quantidade || 0)} ${produto.unidade || ''}`}
            />
            <Detail
              label="Estoque mínimo"
              value={`${formatQtd(produto.estoque_minimo || 0)} ${produto.unidade || ''}`}
            />
            <Detail label="Código ref." value={produto.codigo_referencia || '—'} />
            {dep && (
              <Detail
                label="Depósito"
                value={`${dep.numero}${dep.nome ? ` · ${dep.nome}` : ''}`}
              />
            )}
            {gav && <Detail label="Gaveta" value={gav.codigo} />}
            {maq && <Detail label="Máquina" value={maq.nome} />}
          </div>

          {(!dep && !gav && !maq) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Sem localização vinculada
            </p>
          )}

          {baixo && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" /> Estoque abaixo do mínimo
            </div>
          )}

          {lotesProd.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Layers className="w-3 h-3" /> Lotes
              </p>
              {lotesProd.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between text-xs bg-background/60 rounded px-2 py-1.5"
                >
                  <span className="font-mono truncate">{l.codigo_lote}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {l.data_validade && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(l.data_validade)}
                      </span>
                    )}
                    <span className="font-semibold tabular-nums">
                      {formatQtd(l.quantidade)} {l.unidade || ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}