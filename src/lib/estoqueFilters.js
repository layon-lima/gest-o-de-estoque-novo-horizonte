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

export function matchTerm(produto, termo, maquinas, gavetas) {
  const t = termo.toLowerCase().trim();
  if (!t) return false;

  const maquina = maquinas?.find((m) => m.id === produto.maquina_id);
  const nomeMaquina = (maquina?.nome || '').toLowerCase();
  const gaveta = gavetas?.find((g) => g.id === produto.gaveta_id);
  const codigoGaveta = (gaveta?.codigo || '').toLowerCase();
  const descGaveta = (gaveta?.descricao || '').toLowerCase();

  // "gaveta <num>" → busca por gaveta; "*" no final = correspondência exata
  if (t.startsWith('gaveta')) {
    const rest = t.replace(/^gaveta\s*/, '').trim();
    if (!rest) return Boolean(codigoGaveta || descGaveta);
    if (rest.endsWith('*')) {
      const exato = rest.slice(0, -1).trim();
      return codigoGaveta === exato || descGaveta === exato;
    }
    return codigoGaveta.includes(rest) || descGaveta.includes(rest);
  }

  return (
    (produto.nome || '').toLowerCase().includes(t) ||
    (produto.codigo || '').toLowerCase().includes(t) ||
    (produto.codigo_referencia || '').toLowerCase().includes(t) ||
    nomeMaquina.includes(t) ||
    codigoGaveta.includes(t) ||
    descGaveta.includes(t)
  );
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