// Utilitários do módulo de Inventário (conferência tete-a-tete).

// Gera o próximo número sequencial global de inventário (INV-000001).
export function nextInventarioNumber(inventarios = []) {
  let max = 0;
  inventarios.forEach((i) => {
    const m = String(i.numero || '').match(/INV-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `INV-${String(max + 1).padStart(6, '0')}`;
}

// Filtra os produtos de um setor pelos critérios selecionados (ao menos 1 obrigatório).
export function filterProdutosParaInventario(produtos, setorId, criterios, lotes = []) {
  return produtos
    .filter((p) => p.setor_id === setorId)
    .filter((p) => !criterios.deposito_id || p.deposito_id === criterios.deposito_id)
    .filter((p) => !criterios.gaveta_id || p.gaveta_id === criterios.gaveta_id)
    .filter((p) => !criterios.maquina_id || p.maquina_id === criterios.maquina_id);
}

// Estoque do sistema para um produto: soma dos lotes (FEFO) quando houver, senão quantidade direta.
export function qtdSistema(produto, lotes = []) {
  const lotesProd = (lotes || []).filter((l) => l.produto_id === produto.id && (Number(l.quantidade) || 0) > 0);
  if (lotesProd.length > 0) {
    return lotesProd.reduce((acc, l) => acc + (Number(l.quantidade) || 0), 0);
  }
  return Number(produto.quantidade) || 0;
}

// Descrição legível dos critérios usados.
export function buildCriteriosDescricao(criterios, depositos = [], maquinas = [], gavetas = []) {
  const parts = [];
  if (criterios.deposito_id) {
    const d = depositos.find((x) => x.id === criterios.deposito_id);
    parts.push(`Depósito: ${d ? (d.nome ? `${d.numero} · ${d.nome}` : d.numero) : '—'}`);
  }
  if (criterios.gaveta_id) {
    const g = gavetas.find((x) => x.id === criterios.gaveta_id);
    parts.push(`Gaveta: ${g?.codigo || '—'}`);
  }
  if (criterios.maquina_id) {
    const m = maquinas.find((x) => x.id === criterios.maquina_id);
    parts.push(`Máquina: ${m ? `${m.codigo} · ${m.nome}` : '—'}`);
  }
  return parts.join(' | ') || 'Sem critérios';
}