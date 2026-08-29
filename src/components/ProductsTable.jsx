import { Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getNome } from '@/lib/estoqueFilters';
import { formatQtd, formatMoeda } from '@/lib/format';
import { usePersistentState } from '@/hooks/usePersistentState';
import ProductColumnsToggle, { buildDefaultVisibility } from '@/components/ProductColumnsToggle';

export default function ProductsTable({
  produtos,
  setores,
  maquinas,
  gavetas,
  depositos,
  showStatus = true,
  onEdit,
  onDelete,
}) {
  const [cols, setCols] = usePersistentState(
    'productsTableCols',
    buildDefaultVisibility(showStatus)
  );
  const toggleCol = (key, val) => setCols((prev) => ({ ...prev, [key]: val }));

  const nonZero = produtos.filter((p) => (p.quantidade || 0) > 0);
  const avg = nonZero.reduce((s, p) => s + (p.quantidade || 0), 0) / (nonZero.length || 1);

  const totalBruto = produtos.reduce((s, p) => s + (p.quantidade || 0), 0);
  const totalValor = produtos.reduce((s, p) => s + (Number(p.quantidade) || 0) * (Number(p.custo_unitario) || 0), 0);

  function getStatus(qtd) {
    if (qtd === 0) return { label: 'Zerado', cls: 'bg-red-100 text-red-700 border-red-200' };
    if (qtd >= avg) return { label: 'Alto', cls: 'bg-green-100 text-green-700 border-green-200' };
    return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  }

  function depLabel(p) {
    const num = getNome(p.deposito_id, depositos, 'numero');
    const nome = getNome(p.deposito_id, depositos, 'nome');
    return nome !== '—' ? `${num} — ${nome}` : num;
  }

  const hasActions = onEdit || onDelete;

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
        <span className="text-xs text-muted-foreground">Toque nas colunas para mostrar/ocultar</span>
        <ProductColumnsToggle visibility={cols} onToggle={toggleCol} showStatus={showStatus} />
      </div>
      {/* Desktop: tabela com rolagem interna controlada */}
      <div className="hidden sm:block max-h-[420px] overflow-auto scrollbar-thin">
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              <TableHead>Produto</TableHead>
              {cols.quantidade && <TableHead className="text-right">Quantidade</TableHead>}
              {cols.valor_unit && <TableHead className="text-right">Valor Unit.</TableHead>}
              {cols.valor_total && <TableHead className="text-right">Valor Total</TableHead>}
              {cols.codigo && <TableHead>Código</TableHead>}
              {cols.referencia && <TableHead>Ref.</TableHead>}
              {cols.setor && <TableHead>Setor</TableHead>}
              {cols.deposito && <TableHead>Depósito</TableHead>}
              {cols.maquina && <TableHead>Máquina</TableHead>}
              {cols.gaveta && <TableHead>Gaveta</TableHead>}
              {showStatus && cols.status && <TableHead>Status</TableHead>}
              {hasActions && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtos.map((p) => {
              const st = getStatus(p.quantidade || 0);
              return (
                <TableRow key={p._rowKey || p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  {cols.quantidade && (
                    <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatQtd(p.quantidade || 0)}
                      <span className="text-xs text-muted-foreground ml-1">{p.unidade}</span>
                    </TableCell>
                  )}
                  {cols.valor_unit && (
                    <TableCell className="text-right whitespace-nowrap tabular-nums text-sm">
                      {(Number(p.custo_unitario) || 0) > 0 ? formatMoeda(p.custo_unitario) : '—'}
                    </TableCell>
                  )}
                  {cols.valor_total && (
                    <TableCell className="text-right whitespace-nowrap tabular-nums font-medium">
                      {(Number(p.quantidade) || 0) * (Number(p.custo_unitario) || 0) > 0
                        ? formatMoeda(Number(p.quantidade) * (Number(p.custo_unitario) || 0))
                        : '—'}
                    </TableCell>
                  )}
                  {cols.codigo && <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo}</TableCell>}
                  {cols.referencia && <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo_referencia || '—'}</TableCell>}
                  {cols.setor && <TableCell className="text-sm">{getNome(p.setor_id, setores)}</TableCell>}
                  {cols.deposito && <TableCell className="text-sm">{depLabel(p)}</TableCell>}
                  {cols.maquina && <TableCell className="text-sm">{getNome(p.maquina_id, maquinas)}</TableCell>}
                  {cols.gaveta && <TableCell className="text-sm font-mono">{getNome(p.gaveta_id, gavetas, 'codigo')}</TableCell>}
                  {showStatus && cols.status && (
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
          {produtos.length > 0 && (
            <TableFooter className="sticky bottom-0 bg-muted/70 backdrop-blur-sm z-10">
              <TableRow className="font-semibold hover:bg-transparent border-t-2 border-border">
                <TableCell>Total</TableCell>
                {cols.quantidade && <TableCell className="text-right tabular-nums">{formatQtd(totalBruto)}</TableCell>}
                {cols.valor_unit && <TableCell />}
                {cols.valor_total && <TableCell className="text-right tabular-nums">{formatMoeda(totalValor)}</TableCell>}
                {cols.codigo && <TableCell />}
                {cols.referencia && <TableCell />}
                {cols.setor && <TableCell />}
                {cols.deposito && <TableCell />}
                {cols.maquina && <TableCell />}
                {cols.gaveta && <TableCell />}
                {showStatus && cols.status && <TableCell />}
                {hasActions && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Mobile: cartões empilhados, sem rolagem horizontal */}
      <div className="sm:hidden divide-y">
        {produtos.map((p) => {
          const st = getStatus(p.quantidade || 0);
          return (
            <div key={p._rowKey || p.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-tight">{p.nome}</span>
                {showStatus && (
                  <Badge variant="outline" className={`${st.cls} shrink-0`}>{st.label}</Badge>
                )}
              </div>
              {cols.quantidade && (
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold tabular-nums">{formatQtd(p.quantidade || 0)}</span>
                  <span className="text-xs text-muted-foreground">{p.unidade}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {cols.codigo && <div><span className="font-medium text-foreground/70">Código:</span> <span className="font-mono">{p.codigo}</span></div>}
                {cols.referencia && <div><span className="font-medium text-foreground/70">Ref.:</span> <span className="font-mono">{p.codigo_referencia || '—'}</span></div>}
                {cols.setor && <div className="truncate"><span className="font-medium text-foreground/70">Setor:</span> {getNome(p.setor_id, setores) || '—'}</div>}
                {cols.deposito && <div className="truncate"><span className="font-medium text-foreground/70">Dep.:</span> {depLabel(p)}</div>}
                {cols.maquina && <div className="truncate"><span className="font-medium text-foreground/70">Máq.:</span> {getNome(p.maquina_id, maquinas) || '—'}</div>}
                {cols.gaveta && <div className="truncate"><span className="font-medium text-foreground/70">Gaveta:</span> <span className="font-mono">{getNome(p.gaveta_id, gavetas, 'codigo') || '—'}</span></div>}
                {cols.valor_unit && <div><span className="font-medium text-foreground/70">Valor unit.:</span> {(Number(p.custo_unitario) || 0) > 0 ? formatMoeda(p.custo_unitario) : '—'}</div>}
                {cols.valor_total && <div><span className="font-medium text-foreground/70">Valor total:</span> {(Number(p.quantidade) || 0) * (Number(p.custo_unitario) || 0) > 0 ? formatMoeda(Number(p.quantidade) * (Number(p.custo_unitario) || 0)) : '—'}</div>}
              </div>
              {hasActions && (
                <div className="flex justify-end gap-1 pt-1">
                  {onEdit && (
                    <Button size="sm" variant="outline" onClick={() => onEdit(p)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                  )}
                  {onDelete && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(p)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {produtos.length > 0 && (
        <div className="sm:hidden flex items-center justify-end gap-2 px-4 py-2.5 border-t bg-muted/40 text-sm font-semibold">
          <span>Total:</span>
          <span className="tabular-nums">{formatQtd(totalBruto)}</span>
        </div>
      )}

      {produtos.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum produto encontrado.
        </p>
      )}
    </div>
  );
}