import { useEffect } from 'react';

/**
 * Aplica máscara de MAIÚSCULAS em todos os campos de texto e textarea do app.
 * Funciona em componentes controlados (React) redefinindo o valor nativo e
 * redisparando o evento 'input' para que o onChange do React capture o novo valor.
 */
export function useUppercaseInputs() {
  useEffect(() => {
    const handler = (e) => {
      const el = e.target;
      if (!el || el.nodeType !== 1) return;

      const tag = el.tagName;
      const isInput = tag === 'INPUT';
      const isTextarea = tag === 'TEXTAREA';
      if (!isInput && !isTextarea) return;

      if (isInput) {
        const type = (el.type || '').toLowerCase();
        // Ignora campos não textuais e senhas (não fazem sentido em maiúsculo)
        const skip = ['password', 'number', 'range', 'date', 'datetime-local', 'time', 'month', 'week', 'color', 'file', 'checkbox', 'radio', 'submit', 'button', 'image', 'reset', 'hidden'];
        if (skip.includes(type)) return;
      }

      if (typeof el.value !== 'string') return;
      const upper = el.value.toUpperCase();
      if (upper === el.value) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;

      el.value = upper;
      try { el.setSelectionRange(start, end); } catch (_) { /* alguns inputs não suportam */ }

      // Redispara para que React/ControlledComponents atualizem o estado
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, []);
}

export default useUppercaseInputs;