import { Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getNome } from '@/lib/estoqueFilters';
import { formatQtd } from '@/lib/format';

export default function ProductsTable({
  produtos,
  setores,
  maquinas,
  gavetas,
  showStatus = true,
  onEdit,
  onDelete,
}) {
  const nonZero = produtos.filter((p) => (p.quantidade || 0) > 0);
  const avg = nonZero.reduce((s, p) => s + (p.quantidade || 0), 0) / (nonZero.length || 1);

  function getStatus(qtd) {
    if (qtd === 0) return { label: 'Zerado', cls: 'bg-red-100 text-red-700 border-red-200' };
    if (qtd >= avg) return { label: 'Alto', cls: 'bg-green-100 text-green-700 border-green-200' };
    return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  }

  const hasActions = onEdit || onDelete;

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="max-h-[420px] overflow-auto scrollbar-thin">
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Ref.</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Máquina</TableHead>
              <TableHead>Gaveta</TableHead>
              {showStatus && <TableHead>Status</TableHead>}
              {hasActions && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtos.map((p) => {
              const st = getStatus(p.quantidade || 0);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatQtd(p.quantidade || 0)}
                    <span className="text-xs text-muted-foreground ml-1">{p.unidade}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo_referencia || '—'}</TableCell>
                  <TableCell className="text-sm">{getNome(p.setor_id, setores)}</TableCell>
                  <TableCell className="text-sm">{getNome(p.maquina_id, maquinas)}</TableCell>
                  <TableCell className="text-sm font-mono">{getNome(p.gaveta_id, gavetas, 'codigo')}</TableCell>
                  {showStatus && (
                    <TableCell>
                      <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                    </TableCell>
                  )}
                  {hasActions && (
                    <TableCell className="text-right whitespace-nowrap">
                      {onEdit && (
                        <Button size="icon" variant="ghost" onClick={() => onEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(p)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {produtos.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum produto encontrado.
        </p>
      )}
    </div>
  );
}