import { useState, useRef, useEffect, useMemo } from 'react';
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

  const selectedLabel = useMemo(() => {
    if (value === NEW) return 'Criar novo produto';
    if (value === NONE || !value) return '';
    const p = produtos.find((o) => o.id === value);
    return p ? `${p.codigo} — ${p.nome}` : '';
  }, [value, produtos]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto scrollbar-thin rounded-md border bg-popover text-popover-foreground shadow-md py-1">
          <button
            type="button"
            onClick={() => pick(NONE)}
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
            onClick={() => pick(NEW)}
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
                onClick={() => pick(p.id)}
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
        </div>
      )}
    </div>
  );
}