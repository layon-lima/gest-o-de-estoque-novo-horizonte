import { useCallback, useEffect, useState } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';

function readStoredWidths(storageKey) {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(`${storageKey}:widths`);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

// Estado persistido por tabela:
// - `order` mantém as colunas visíveis e a ordem durante a sessão;
// - `widths` guarda no navegador a largura escolhida manualmente pelo usuário.
export function useColumnConfig(storageKey, defaultOrder) {
  const [order, setOrder] = usePersistentState(storageKey, defaultOrder);
  const [widths, setWidths] = useState(() => readStoredWidths(storageKey));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        `${storageKey}:widths`,
        JSON.stringify(widths)
      );
    } catch {
      // A tabela continua funcionando mesmo se o navegador bloquear storage.
    }
  }, [storageKey, widths]);

  const toggle = useCallback((key) => {
    setOrder((prev) => {
      const p = Array.isArray(prev) ? prev : defaultOrder;
      return p.includes(key) ? p.filter((k) => k !== key) : [...p, key];
    });
  }, [defaultOrder, setOrder]);

  const reorder = useCallback((from, to) => {
    setOrder((prev) => {
      const p = [...(Array.isArray(prev) ? prev : defaultOrder)];
      if (from < 0 || from >= p.length || to < 0 || to >= p.length) return p;
      const [moved] = p.splice(from, 1);
      p.splice(to, 0, moved);
      return p;
    });
  }, [defaultOrder, setOrder]);

  const setWidth = useCallback((key, value) => {
    const width = Math.round(Number(value));
    if (!Number.isFinite(width) || width <= 0) return;

    setWidths((prev) => ({
      ...(prev && typeof prev === 'object' ? prev : {}),
      [key]: width,
    }));
  }, []);

  return {
    order: Array.isArray(order) ? order : defaultOrder,
    toggle,
    reorder,
    widths: widths && typeof widths === 'object' ? widths : {},
    setWidth,
  };
}
