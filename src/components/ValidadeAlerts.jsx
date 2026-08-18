import { AlertTriangle, AlertCircle, CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getNome } from '@/lib/estoqueFilters';
import { statusValidade } from '@/lib/lotes';
import ValidadeBadge from '@/components/ValidadeBadge';

export default function ValidadeAlerts({ lotes, produtos, setores, maquinas, gavetas }) {
  const now = new Date();
  const comSaldo = lotes.filter((l) => (l.quantidade || 0) > 0);
  const vencidos = comSaldo.filter((l) => statusValidade(l, now).key === 'vencido');
  const proximos = comSaldo.filter((l) => ['30', '60', '90'].includes(statusValidade(l, now).key));
  const criticos = [...vencidos, ...proximos].slice(0, 8);
  const hasAlerts = criticos.length > 0;

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-amber-500" />
        Alertas de Validade
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${vencidos.length ? 'bg-red-50 border-red-200' : 'bg-muted/40 border-border'}`}>
          <AlertCircle className={`w-5 h-5 shrink-0 ${vencidos.length ? 'text-red-600' : 'text-muted-foreground'}`} />
          <div>
            <p className="text-sm font-medium">{vencidos.length} vencido(s)</p>
            <p className="text-xs text-muted-foreground">Lotes com saldo</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${proximos.length ? 'bg-amber-50 border-amber-200' : 'bg-muted/40 border-border'}`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 ${proximos.length ? 'text-amber-600' : 'text-muted-foreground'}`} />
          <div>
            <p className="text-sm font-medium">{proximos.length} próximo(s)</p>
            <p className="text-xs text-muted-foreground">Até 90 dias</p>
          </div>
        </div>
      </div>

      {hasAlerts ? (
        <div className="space-y-2">
          {criticos.map((l) => {
            const produto = produtos.find((p) => p.id === l.produto_id);
            return (
              <div key={l.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{produto?.nome || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Lote {l.codigo_lote} · {getNome(l.setor_id, setores)} · {getNome(l.maquina_id, maquinas)} / {getNome(l.gaveta_id, gavetas, 'codigo')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">{l.quantidade}</span>
                  <ValidadeBadge dataValidade={l.data_validade} now={now} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum lote próximo do vencimento.</p>
      )}
    </Card>
  );
}