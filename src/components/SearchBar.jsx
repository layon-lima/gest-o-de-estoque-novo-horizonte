import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function matchTerm(produto, termo) {
  const t = termo.toLowerCase().trim();
  if (!t) return false;
  return (
    (produto.nome || '').toLowerCase().includes(t) ||
    (produto.codigo || '').toLowerCase().includes(t) ||
    (produto.codigo_referencia || '').toLowerCase().includes(t)
  );
}

export default function SearchBar({ value, onChange, produtos, maquinas }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef(null);

  const termos = value.split(',').map((t) => t.trim()).filter(Boolean);

  const suggestions = useMemo(() => {
    if (termos.length === 0) return [];
    const matches = produtos.filter((p) => termos.every((termo) => matchTerm(p, termo)));
    return matches.slice(0, 8);
  }, [produtos, value]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getMaquinaNome = (p) => {
    const m = maquinas?.find((m) => m.id === p.maquina_id);
    return m?.nome || '';
  };

  const handleSelect = (produto) => {
    onChange(produto.nome);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative flex-1 min-w-[280px] max-w-md" ref={containerRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar por nome, código ou referência… (vírgulas combinam)"
        className="pl-10 pr-10 h-12 text-base font-medium border-primary/30 focus-visible:ring-primary"
      />
      {value && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => { onChange(''); setShowSuggestions(false); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {suggestions.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 border-b border-border/50 last:border-0 hover:bg-accent transition-colors ${
                idx === highlightIndex ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{p.nome}</span>
                <span className="text-xs text-muted-foreground shrink-0">{p.codigo}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {p.codigo_referencia && <span>Ref: {p.codigo_referencia}</span>}
                {getMaquinaNome(p) && <span className="truncate">{getMaquinaNome(p)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}