import { useState, useRef, useMemo } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

// Combobox genérico baseado no Popover nativo do Radix. Ao contrário de um
// portal customizado no body, o Popover se registra como "ramo" do
// DismissableLayer do Dialog pai, permitindo que os itens sejam clicados
// normalmente dentro de um Dialog modal.
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
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

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
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-accent/40 transition-colors',
            className
          )}
        >
          <span className={cn('truncate text-left flex-1 min-w-0', !selected && !allLabel && 'text-muted-foreground')}>
            {selected ? selected.label : (value === 'all' && allLabel ? allLabel : placeholder)}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {selected && (
              <X
                className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground"
                onClick={clear}
              />
            )}
            <ChevronDown className="w-4 h-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-auto scrollbar-thin py-1">
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
        </div>
      </PopoverContent>
    </Popover>
  );
}