// Unidades de medida suportadas, agrupadas por família.
// Cada unidade tem um fator relativo à unidade base da família
// (ex.: 1 ton = 1000 kg; 1 kg = 1000 g; 1 L = 1000 mL; 1 km = 1000 m).

export const UNIDADES = [
  {
    familia: 'Massa',
    itens: [
      { value: 'ton', label: 'tonelada (ton)' },
      { value: 'kg', label: 'quilograma (kg)' },
      { value: 'g', label: 'grama (g)' },
    ],
  },
  {
    familia: 'Volume',
    itens: [
      { value: 'L', label: 'litro (L)' },
      { value: 'mL', label: 'mililitro (mL)' },
    ],
  },
  {
    familia: 'Comprimento',
    itens: [
      { value: 'km', label: 'quilômetro (km)' },
      { value: 'm', label: 'metro (m)' },
      { value: 'cm', label: 'centímetro (cm)' },
      { value: 'mm', label: 'milímetro (mm)' },
    ],
  },
  {
    familia: 'Outros',
    itens: [
      { value: 'un', label: 'unidade (un)' },
    ],
  },
];

const FATORES = {
  Massa: { ton: 1000, kg: 1, g: 0.001 },
  Volume: { L: 1, mL: 0.001 },
  Comprimento: { km: 1000, m: 1, cm: 0.01, mm: 0.001 },
  Outros: { un: 1 },
};

function familiaDe(unidade) {
  for (const f of UNIDADES) {
    if (f.itens.some((i) => i.value === unidade)) return f.familia;
  }
  return null;
}

// Retorna true se `de` e `para` pertencem à mesma família (conversíveis).
export function isConversivel(de, para) {
  if (!de || !para || de === para) return false;
  const famDe = familiaDe(de);
  const famPara = familiaDe(para);
  return !!(famDe && famPara && famDe === famPara);
}

// Converte `value` da unidade `de` para `para`.
// Retorna null quando as unidades são de famílias diferentes.
export function convertQty(value, de, para) {
  if (!de || !para) return null;
  if (de === para) return Number(value) || 0;
  const famDe = familiaDe(de);
  const famPara = familiaDe(para);
  if (!famDe || !famPara || famDe !== famPara) return null;
  const fatorDe = FATORES[famDe][de];
  const fatorPara = FATORES[famPara][para];
  if (!fatorDe || !fatorPara) return null;
  const base = (Number(value) || 0) * fatorDe;
  return base / fatorPara;
}

export function getUnidadeLabel(unidade) {
  for (const f of UNIDADES) {
    const item = f.itens.find((i) => i.value === unidade);
    if (item) return item.label;
  }
  return unidade || '';
}