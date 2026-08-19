import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Buscar...',
  allLabel,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const updateCoords = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setCoords({ top: r.bottom, left: r.left, width: r.width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    const onScroll = () => updateCoords();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function pick(v) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  function clear(e) {
    e.stopPropagation();
    pick(allLabel ? 'all' : '');
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-accent/40 transition-colors"
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={selected ? selected.label : placeholder}
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" onClick={clear} />
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </div>
      </div>

      {open && createPortal(
        <div
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
          className="z-[100] mt-1 max-h-60 overflow-auto scrollbar-thin rounded-md border bg-popover text-popover-foreground shadow-md py-1"
        >
          {allLabel && (
            <button
              type="button"
              onClick={() => pick('all')}
              className={cn(
                'flex items-center justify-between w-full px-3 py-1.5 text-sm text-left hover:bg-accent',
                value === 'all' && 'bg-accent'
              )}
            >
              <span>{allLabel}</span>
              {value === 'all' && <Check className="w-4 h-4" />}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className={cn(
                  'flex items-center justify-between w-full px-3 py-1.5 text-sm text-left hover:bg-accent',
                  value === o.value && 'bg-accent'
                )}
              >
                <span className="truncate">{o.label}</span>
                {value === o.value && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}