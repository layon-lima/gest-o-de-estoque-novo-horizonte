import { useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Eye, EyeOff, GripVertical, Settings2 } from 'lucide-react';
import {
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const DEFAULT_MIN_COLUMN_WIDTH = 72;

function getMinWidth(col) {
  const value = Number(col?.minWidth);
  return Number.isFinite(value) && value > 0
    ? Math.max(DEFAULT_MIN_COLUMN_WIDTH, value)
    : DEFAULT_MIN_COLUMN_WIDTH;
}

// Tabela genérica com:
//  - colunas arrastáveis para reordenação;
//  - largura manual redimensionável nos dois sentidos, com mínimo seguro;
//  - largura escolhida persistida no navegador;
//  - conteúdo ancorado à esquerda, sem esticar/mover junto com a coluna;
//  - toggle de visibilidade sem checkbox.
//
// `config` vem de useColumnConfig(storageKey, defaultOrder).
// `columns`: [{ key, label, render:(row,ctx)=>node, footer?:(ctx)=>node,
//                minWidth?, headerClassName?, cellClassName? }]
export default function DataTable({
  config,
  columns,
  data,
  getRowId = (row, i) => row.id || String(i),
  ctx,
  onRowClick,
  rowClassName,
  footerLabel = 'Total',
  emptyMessage = 'Nenhum registro encontrado.',
  containerClassName = 'max-h-[560px]',
  toggleLabel = 'Colunas',
  showToolbar = true,
}) {
  const defaultOrder = columns.map((c) => c.key);
  const { order, toggle, reorder, widths = {}, setWidth } = config;

  const visibleColumns = order
    .map((key) => columns.find((c) => c.key === key))
    .filter(Boolean);

  const [dragging, setDragging] = useState(false);
  const [liveWidths, setLiveWidths] = useState(widths);
  const resizeCleanupRef = useRef(null);

  useEffect(() => {
    setLiveWidths(widths || {});
  }, [widths]);

  useEffect(() => {
    return () => resizeCleanupRef.current?.();
  }, []);

  function onDragEnd(result) {
    setDragging(false);
    if (!result.destination || result.destination.index === result.source.index) return;
    reorder(result.source.index, result.destination.index);
  }

  function columnStyle(col) {
    const minWidth = getMinWidth(col);
    const configured = Number(liveWidths?.[col.key]);
    const width = Number.isFinite(configured) && configured > 0
      ? Math.max(minWidth, configured)
      : null;

    return width
      ? { width, minWidth, maxWidth: width }
      : { minWidth };
  }

  function startResize(event, col) {
    if (typeof setWidth !== 'function') return;

    event.preventDefault();
    event.stopPropagation();

    const header = event.currentTarget.closest('th');
    const startX = event.clientX;
    const minWidth = getMinWidth(col);
    const startWidth = Math.max(
      minWidth,
      Math.round(header?.getBoundingClientRect().width || minWidth)
    );

    let nextWidth = startWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      resizeCleanupRef.current = null;
    };

    const handleMove = (moveEvent) => {
      nextWidth = Math.max(
        minWidth,
        Math.round(startWidth + (moveEvent.clientX - startX))
      );

      setLiveWidths((prev) => ({
        ...(prev || {}),
        [col.key]: nextWidth,
      }));
    };

    const handleUp = () => {
      setWidth(col.key, nextWidth);
      cleanup();
    };

    resizeCleanupRef.current?.();
    resizeCleanupRef.current = cleanup;

    setLiveWidths((prev) => ({
      ...(prev || {}),
      [col.key]: startWidth,
    }));

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }

  const hasFooter = columns.some((c) => c.footer);

  return (
    <div className="w-full min-w-0 rounded-lg border overflow-hidden">
      {showToolbar && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5" />
            Arraste o puxador para reordenar e a divisória para redimensionar
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> {toggleLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground px-1 mb-1">
                  Mostrar colunas
                </p>
                {defaultOrder.map((key) => {
                  const col = columns.find((c) => c.key === key);
                  if (!col) return null;
                  const visible = order.includes(key);

                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => toggle(key)}
                      className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-muted/50"
                    >
                      {visible ? (
                        <Eye className="h-4 w-4 text-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{col.label}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className={`block w-full min-w-0 overflow-auto scrollbar-thin ${containerClassName}`}>
        <table className="w-full min-w-full table-auto caption-bottom text-sm">
          <TableHeader className="sticky top-0 bg-muted z-10">
            <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={onDragEnd}>
              <Droppable droppableId="dt-header" direction="horizontal" type="column">
                {(provided) => (
                  <TableRow ref={provided.innerRef} {...provided.droppableProps}>
                    {visibleColumns.map((col, index) => (
                      <Draggable draggableId={col.key} index={index} key={col.key}>
                        {(p) => (
                          <TableHead
                            ref={p.innerRef}
                            {...p.draggableProps}
                            style={{
                              ...p.draggableProps.style,
                              ...columnStyle(col),
                            }}
                            className={`relative select-none px-2 ${col.headerClassName || ''}`}
                          >
                            <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-left">
                              <span
                                {...p.dragHandleProps}
                                className={`inline-flex shrink-0 items-center ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                              >
                                <GripVertical className="h-3 w-3 text-muted-foreground/60" />
                              </span>
                              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                                {col.label}
                              </span>
                            </div>

                            {typeof setWidth === 'function' && (
                              <span
                                role="separator"
                                aria-orientation="vertical"
                                aria-label={`Redimensionar coluna ${col.label}`}
                                onPointerDown={(event) => startResize(event, col)}
                                className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize touch-none select-none"
                              >
                                <span className="absolute right-0 top-1/4 h-1/2 w-px bg-border/80" />
                              </span>
                            )}
                          </TableHead>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </TableRow>
                )}
              </Droppable>
            </DragDropContext>
          </TableHeader>

          <TableBody>
            {data.map((row, i) => (
              <TableRow
                key={getRowId(row, i)}
                onClick={onRowClick ? () => onRowClick(row, ctx) : undefined}
                className={typeof rowClassName === 'function' ? rowClassName(row, ctx) : rowClassName}
              >
                {visibleColumns.map((col) => (
                  <TableCell
                    key={col.key}
                    style={columnStyle(col)}
                    className={`px-2 ${col.cellClassName || ''}`}
                  >
                    <div className="min-w-0 overflow-hidden whitespace-nowrap text-left">
                      {col.render ? col.render(row, ctx) : null}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={Math.max(1, visibleColumns.length)}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {hasFooter && data.length > 0 && (
            <TableFooter className="sticky bottom-0 z-10 bg-muted/70 backdrop-blur-sm">
              <TableRow className="border-t-2 border-border font-semibold hover:bg-transparent">
                {visibleColumns.map((col, i) => (
                  <TableCell
                    key={col.key}
                    style={columnStyle(col)}
                    className={`${col.cellClassName || ''}`}
                  >
                    <div className="min-w-0 overflow-hidden whitespace-nowrap text-left">
                      {i === 0 ? footerLabel : col.footer ? col.footer(ctx) : ''}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </table>
      </div>
    </div>
  );
}
