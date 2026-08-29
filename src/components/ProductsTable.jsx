import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getNome } from '@/lib/estoqueFilters';
import { formatQtd, formatMoeda } from '@/lib/format';
import { useColumnConfig } from '@/hooks/useColumnConfig';
import DataTable from '@/components/tables/DataTable';

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
  const hasActions = onEdit || onDelete;

  const nonZero = produtos.filter((p) => (p.quantidade || 0) > 0);
  const avg = nonZero.reduce((s, p) => s + (p.quantidade || 0), 0) / (nonZero.length || 1);
  const totalBruto = produtos.reduce((s, p) => s + (p.quantidade || 0), 0);
  const totalValor = produtos.reduce(
    (s, p) => s + (Number(p.quantidade) || 0) * (Number(p.custo_unitario) || 0),
    0
  );

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

  const columns = [
    { key: 'nome', label: 'Produto', render: (p) => <span className="font-medium">{p.nome}</span> },
    {
      key: 'quantidade',
      label: 'Quantidade',
      align: 'right',
      render: (p) => (
        <span className="text-right font-semibold tabular-nums">
          {formatQtd(p.quantidade || 0)}
          <span className="text-xs text-muted-foreground ml-1">{p.unidade}</span>
        </span>
      ),
      footer: () => formatQtd(totalBruto),
      cellClassName: 'text-right font-semibold tabular-nums',
    },
    {
      key: 'valor_unit',
      label: 'Valor Unit.',
      align: 'right',
      render: (p) => (Number(p.custo_unitario) || 0) > 0 ? formatMoeda(p.custo_unitario) : '—',
      cellClassName: 'text-right tabular-nums text-sm',
    },
    {
      key: 'valor_total',
      label: 'Valor Total',
      align: 'right',
      render: (p) =>
        (Number(p.quantidade) || 0) * (Number(p.custo_unitario) || 0) > 0
          ? formatMoeda(Number(p.quantidade) * (Number(p.custo_unitario) || 0))
          : '—',
      footer: () => formatMoeda(totalValor),
      cellClassName: 'text-right tabular-nums font-medium',
    },
    { key: 'codigo', label: 'Código', render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.codigo}</span> },
    { key: 'referencia', label: 'Ref.', render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.codigo_referencia || '—'}</span> },
    { key: 'setor', label: 'Setor', render: (p, c) => <span className="text-sm">{getNome(p.setor_id, c.setores)}</span>, cellClassName: 'text-sm' },
    { key: 'deposito', label: 'Depósito', render: (p, c) => <span className="text-sm">{c.depLabel(p)}</span>, cellClassName: 'text-sm' },
    { key: 'maquina', label: 'Máquina', render: (p, c) => <span className="text-sm">{getNome(p.maquina_id, c.maquinas)}</span>, cellClassName: 'text-sm' },
    { key: 'gaveta', label: 'Gaveta', render: (p, c) => <span className="text-sm font-mono">{getNome(p.gaveta_id, c.gavetas, 'codigo')}</span>, cellClassName: 'text-sm font-mono' },
    ...(showStatus
      ? [
          {
            key: 'status',
            label: 'Status',
            render: (p, c) => {
              const st = c.getStatus(p.quantidade || 0);
              return <Badge variant="outline" className={st.cls}>{st.label}</Badge>;
            },
          },
        ]
      : []),
    ...(hasActions
      ? [
          {
            key: 'actions',
            label: 'Ações',
            align: 'right',
            render: (p, c) => (
              <span className="inline-flex gap-1">
                {c.onEdit && (
                  <Button size="icon" variant="ghost" onClick={() => c.onEdit(p)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {c.onDelete && (
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => c.onDelete(p)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </span>
            ),
          },
        ]
      : []),
  ];

  const config = useColumnConfig('productsTableCols', columns.map((c) => c.key));
  const visible = config.order;
  const ctx = { setores, maquinas, gavetas, depositos, getStatus, depLabel, onEdit, onDelete };

  return (
    <div>
      {/* Desktop: tabela com colunas arrastáveis, sem quebra de texto */}
      <div className="hidden sm:block">
        <DataTable
          config={config}
          columns={columns}
          data={produtos}
          getRowId={(p) => p._rowKey || p.id}
          ctx={ctx}
          footerLabel="Total"
          containerClassName="max-h-[420px]"
          toggleLabel="Colunas"
        />
      </div>

      {/* Mobile: cartões empilhados (sem rolagem horizontal) */}
      <div className="sm:hidden divide-y">
        {produtos.map((p) => {
          const st = getStatus(p.quantidade || 0);
          return (
            <div key={p._rowKey || p.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-tight">{p.nome}</span>
                {showStatus && visible.includes('status') && (
                  <Badge variant="outline" className={`${st.cls} shrink-0`}>{st.label}</Badge>
                )}
              </div>
              {visible.includes('quantidade') && (
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold tabular-nums">{formatQtd(p.quantidade || 0)}</span>
                  <span className="text-xs text-muted-foreground">{p.unidade}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {visible.includes('codigo') && <div><span className="font-medium text-foreground/70">Código:</span> <span className="font-mono">{p.codigo}</span></div>}
                {visible.includes('referencia') && <div><span className="font-medium text-foreground/70">Ref.:</span> <span className="font-mono">{p.codigo_referencia || '—'}</span></div>}
                {visible.includes('setor') && <div><span className="font-medium text-foreground/70">Setor:</span> {getNome(p.setor_id, setores) || '—'}</div>}
                {visible.includes('deposito') && <div><span className="font-medium text-foreground/70">Dep.:</span> {depLabel(p)}</div>}
                {visible.includes('maquina') && <div><span className="font-medium text-foreground/70">Máq.:</span> {getNome(p.maquina_id, maquinas) || '—'}</div>}
                {visible.includes('gaveta') && <div><span className="font-medium text-foreground/70">Gaveta:</span> <span className="font-mono">{getNome(p.gaveta_id, gavetas, 'codigo') || '—'}</span></div>}
                {visible.includes('valor_unit') && <div><span className="font-medium text-foreground/70">Valor unit.:</span> {(Number(p.custo_unitario) || 0) > 0 ? formatMoeda(p.custo_unitario) : '—'}</div>}
                {visible.includes('valor_total') && <div><span className="font-medium text-foreground/70">Valor total:</span> {(Number(p.quantidade) || 0) * (Number(p.custo_unitario) || 0) > 0 ? formatMoeda(Number(p.quantidade) * (Number(p.custo_unitario) || 0)) : '—'}</div>}
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
        {produtos.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum produto encontrado.</p>
        )}
      </div>

      {produtos.length > 0 && (
        <div className="sm:hidden flex items-center justify-end gap-2 px-4 py-2.5 border-t bg-muted/40 text-sm font-semibold">
          {visible.includes('quantidade') && (
            <>
              <span>Total:</span>
              <span className="tabular-nums">{formatQtd(totalBruto)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}