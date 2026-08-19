import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, PlusCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

const NONE = 'none';
const NEW = 'new';

export default function ProdutoCombobox({
  value,
  onChange,
  produtos = [],
  placeholder = 'Buscar produto…',
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUp: false });

  const selectedLabel = useMemo(() => {
    if (value === NEW) return 'Criar novo produto';
    if (value === NONE || !value) return '';
    const p = produtos.find((o) => o.id === value);
    return p ? `${p.codigo} — ${p.nome}` : '';
  }, [value, produtos]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function handleScroll() { position(); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open) position();
  }, [open, query]);

  function position() {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuH = 288;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuH + 16 && rect.top > spaceBelow;
    setCoords({
      top: openUp ? rect.top - menuH - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
      openUp,
    });
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return produtos;
    return produtos.filter((p) => {
      const label = `${p.codigo} ${p.nome}`.toLowerCase();
      return label.includes(q);
    });
  }, [produtos, query]);

  function pick(v) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-sm cursor-pointer hover:bg-accent/40 transition-colors"
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={selectedLabel || placeholder}
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              'truncate',
              value === NEW && 'text-primary font-medium',
              !value && 'text-muted-foreground'
            )}
          >
            {value === NEW ? (
              <span className="flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Criar novo produto
              </span>
            ) : (
              selectedLabel || placeholder
            )}
          </span>
        )}
        <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
      </div>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
          className="z-[100] max-h-72 overflow-auto scrollbar-thin rounded-md border bg-popover text-popover-foreground shadow-md py-1"
        >
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); pick(NONE); }}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-accent',
              value === NONE && 'bg-accent'
            )}
          >
            <Ban className="w-3.5 h-3.5 opacity-60" />
            <span className="text-muted-foreground">— Nenhum —</span>
            {value === NONE && <Check className="w-4 h-4 ml-auto" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); pick(NEW); }}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-accent text-primary font-medium',
              value === NEW && 'bg-accent'
            )}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Criar novo produto</span>
            {value === NEW && <Check className="w-4 h-4 ml-auto" />}
          </button>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onPointerDown={(e) => { e.preventDefault(); pick(p.id); }}
                className={cn(
                  'flex items-center justify-between w-full px-3 py-1.5 text-xs text-left hover:bg-accent',
                  value === p.id && 'bg-accent'
                )}
              >
                <span className="truncate">{p.codigo} — {p.nome}</span>
                {value === p.id && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}