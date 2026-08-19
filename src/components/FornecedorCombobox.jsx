import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function FornecedorCombobox({
  value,
  onChange,
  suggestions = [],
  placeholder,
  id,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);

  const filtered = suggestions
    .filter((s) => s && s.toLowerCase().includes((value || '').toLowerCase().trim()))
    .slice(0, 20);

  const updateCoords = () => {
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
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
      const inTrigger = wrapperRef.current && wrapperRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inTrigger && !inMenu) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function pick(s) {
    onChange(s);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
          className="z-[100] mt-1 max-h-60 overflow-auto scrollbar-thin rounded-md border bg-popover text-popover-foreground shadow-md py-1"
        >
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className={cn(
                'flex items-center w-full px-3 py-1.5 text-sm text-left hover:bg-accent truncate',
                s === value && 'bg-accent'
              )}
            >
              {s}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}