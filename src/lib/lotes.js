// Utilitários para controle de validade por lote (FEFO)

export function diasParaVencer(dataValidade, now = new Date()) {
  if (!dataValidade) return null;
  const validade = new Date(dataValidade);
  if (isNaN(validade.getTime())) return null;
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const v = new Date(validade.getFullYear(), validade.getMonth(), validade.getDate());
  return Math.floor((v - hoje) / (1000 * 60 * 60 * 24));
}

export function statusValidade(lote, now = new Date()) {
  const dias = diasParaVencer(lote?.data_validade, now);
  if (dias === null) return { key: 'sem_validade', label: 'Sem validade', dias: null };
  if (dias < 0) return { key: 'vencido', label: 'Vencido', dias };
  if (dias <= 30) return { key: '30', label: '≤ 30 dias', dias };
  if (dias <= 60) return { key: '60', label: '≤ 60 dias', dias };
  if (dias <= 90) return { key: '90', label: '≤ 90 dias', dias };
  return { key: 'ok', label: 'Válido', dias };
}

export const FAIXAS_VALIDADE = [
  { value: 'all', label: 'Todas' },
  { value: 'vencido', label: 'Vencidos' },
  { value: '30', label: '≤ 30 dias' },
  { value: '60', label: '≤ 60 dias' },
  { value: '90', label: '≤ 90 dias' },
  { value: 'ok', label: 'Válidos' },
];

export function filterLotesByFaixa(lotes, faixa, now = new Date()) {
  if (!faixa || faixa === 'all') return lotes;
  return lotes.filter((l) => statusValidade(l, now).key === faixa);
}

// FEFO: consome a quantidade dos lotes ordenados por validade crescente
export function consumirFefo(lotes, quantidade) {
  const ordenados = [...lotes]
    .filter((l) => (l.quantidade || 0) > 0 && l.data_validade)
    .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

  let restante = quantidade;
  const alocacoes = [];
  for (const lote of ordenados) {
    if (restante <= 0) break;
    const disp = lote.quantidade || 0;
    if (disp <= 0) continue;
    const consumo = Math.min(disp, restante);
    alocacoes.push({ lote_id: lote.id, quantidade: consumo, data_validade: lote.data_validade });
    restante -= consumo;
  }
  const totalDisponivel = ordenados.reduce((s, l) => s + (l.quantidade || 0), 0);
  return { alocacoes, totalDisponivel, suficiente: restante <= 0 };
}

export function somaLotes(lotes) {
  return lotes.reduce((s, l) => s + (l.quantidade || 0), 0);
}

export function setorControlaValidade(setorId, setores) {
  const setor = setores?.find((s) => s.id === setorId);
  return !!setor?.controla_validade;
}