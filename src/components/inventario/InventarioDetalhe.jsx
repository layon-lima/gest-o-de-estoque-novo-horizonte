import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatQtd } from '@/lib/format';

function fmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function InventarioDetalhe({ inventario, open, onOpenChange }) {
  let itens = [];
  try {
    itens = inventario?.itens ? JSON.parse(inventario.itens) : [];
  } catch {
    itens = [];
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Inventário {inventario?.numero || ''}
            {inventario?.resultado === 'consistente' ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" />Consistente</Badge>
            ) : (
              <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Divergente</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Card className="p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{fmtData(inventario?.data)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Setor</span><span className="font-medium">{inventario?.setor_nome || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Critérios</span><span className="font-medium text-right">{inventario?.criterios_descricao || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Responsável</span><span className="font-medium">{inventario?.responsavel || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Resumo</span><span className="font-medium">{inventario?.total_acertos}/{inventario?.total_itens} conferem · {inventario?.total_divergencias} divergência(s)</span></div>
          </Card>

          <div className="overflow-x-auto max-h-[45vh] overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Sistema</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it) => (
                  <TableRow key={it.produto_id}>
                    <TableCell>
                      <p className="font-medium text-sm">{it.nome}</p>
                      <p className="text-xs text-muted-foreground font-mono">{it.codigo}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatQtd(it.qtd_sistema)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatQtd(it.qtd_contada)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={it.status === 'acerto' ? 'secondary' : 'destructive'} className="tabular-nums">
                        {it.divergencia > 0 ? '+' : ''}{formatQtd(it.divergencia)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}