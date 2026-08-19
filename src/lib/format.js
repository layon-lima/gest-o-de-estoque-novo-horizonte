// Formatação e parse de quantidades no padrão pt-BR (ex.: 1.234,56)

export function formatQtd(n) {
  const num = Number(n);
  if (!isFinite(num)) return '0,00';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Formato para campos de entrada: 2 decimais, sem separador de milhar (ex.: 1500,00).
export function formatInputQtd(n) {
  const num = Number(n);
  if (!isFinite(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

// Converte string pt-BR ('1.234,56', '0,5', '1,5') em Number.
// Também aceita formatos com ponto decimal ('1.5') por robustez.
export function parseQtd(str) {
  if (typeof str === 'number') return str;
  if (str == null) return 0;
  const s = String(str).trim();
  if (s === '') return 0;
  // Se há vírgula: trata como separador decimal pt-BR
  if (s.includes(',')) {
    const limpo = s.replace(/\./g, '').replace(',', '.');
    const n = Number(limpo);
    return isFinite(n) ? n : 0;
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}