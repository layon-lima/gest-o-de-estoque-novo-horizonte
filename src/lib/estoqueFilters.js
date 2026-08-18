export function filterProdutos(produtos, filtros) {
  let result = [...produtos];

  if (filtros.setor_id) result = result.filter((p) => p.setor_id === filtros.setor_id);
  if (filtros.maquina_id) result = result.filter((p) => p.maquina_id === filtros.maquina_id);
  if (filtros.gaveta_id) result = result.filter((p) => p.gaveta_id === filtros.gaveta_id);

  if (filtros.estoque === 'ZERADO') {
    result = result.filter((p) => (p.quantidade || 0) === 0);
  } else if (filtros.estoque === 'ALTO' || filtros.estoque === 'BAIXO') {
    const nonZero = result.filter((p) => (p.quantidade || 0) > 0);
    const avg = nonZero.reduce((s, p) => s + (p.quantidade || 0), 0) / (nonZero.length || 1);
    result =
      filtros.estoque === 'ALTO'
        ? nonZero.filter((p) => (p.quantidade || 0) >= avg)
        : nonZero.filter((p) => (p.quantidade || 0) < avg);
  }

  return result;
}

export function getNome(id, lista, field = 'nome') {
  const item = lista?.find((i) => i.id === id);
  return item?.[field] || '—';
}

export function getEstoqueStatus(produto, avg, produtosDoSetor) {
  const qtd = produto.quantidade || 0;
  if (qtd === 0) return 'zerado';
  const setorAvg =
    produtosDoSetor.filter((p) => (p.quantidade || 0) > 0).reduce((s, p) => s + (p.quantidade || 0), 0) /
      (produtosDoSetor.filter((p) => (p.quantidade || 0) > 0).length || 1) || 0;
  if (qtd >= setorAvg) return 'alto';
  return 'baixo';
}