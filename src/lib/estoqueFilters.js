// Quantidade física de um produto em um depósito (opcionalmente por gaveta),
// somada a partir dos saldos reais (SaldoEstoque). Modelo SAP.
export function getQtdNoDeposito(produtoId, depositoId, gavetaId = '', saldos = []) {
  if (!depositoId) return 0;
  return (saldos || [])
    .filter(
      (s) =>
        s.produto_id === produtoId &&
        s.deposito_id === depositoId &&
        (s.quantidade || 0) > 0 &&
        (!gavetaId || (s.gaveta_id || '') === gavetaId)
    )
    .reduce((sum, s) => sum + (s.quantidade || 0), 0);
}

export function filterProdutos(produtos, filtros, saldos = []) {
  let result = [...produtos];

  if (filtros.setor_id) result = result.filter((p) => p.setor_id === filtros.setor_id);

  // SAP: o filtro por depósito é baseado no saldo físico (SaldoEstoque), não no
  // campo único Produto.deposito_id. Um produto aparece no depósito se tiver
  // saldo > 0 nele; a quantidade exibida passa a ser a do depósito (e gaveta).
  if (filtros.deposito_id) {
    if ((saldos || []).length > 0) {
      // SAP: saldo físico real no depósito (com gaveta se filtrada).
      const gav = filtros.gaveta_id || '';
      result = result
        .filter((p) => getQtdNoDeposito(p.id, filtros.deposito_id, gav, saldos) > 0)
        .map((p) => ({
          ...p,
          quantidade: getQtdNoDeposito(p.id, filtros.deposito_id, gav, saldos),
          deposito_id: filtros.deposito_id,
          ...(gav ? { gaveta_id: gav } : {}),
        }));
    } else {
      // Fallback: sem saldos carregados, usa o campo único do produto.
      result = result.filter((p) => p.deposito_id === filtros.deposito_id);
    }
  } else if (filtros.gaveta_id) {
    result = result.filter((p) => p.gaveta_id === filtros.gaveta_id);
  }

  if (filtros.maquina_id) result = result.filter((p) => p.maquina_id === filtros.maquina_id);

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

export function matchTerm(produto, termo, maquinas, gavetas, depositos, saldos = []) {
  const t = termo.toLowerCase().trim();
  if (!t) return false;

  const maquina = maquinas?.find((m) => m.id === produto.maquina_id);
  const nomeMaquina = (maquina?.nome || '').toLowerCase();
  const gaveta = gavetas?.find((g) => g.id === produto.gaveta_id);
  const codigoGaveta = (gaveta?.codigo || '').toLowerCase();
  const descGaveta = (gaveta?.descricao || '').toLowerCase();

  // SAP: depósitos onde o produto REALMENTE tem saldo físico.
  // Fallback: sem saldos carregados, usa o depósito "casa" do produto.
  const homeDep = depositos?.find((d) => d.id === produto.deposito_id);
  const depsComSaldo =
    (saldos || []).length > 0
      ? (saldos || [])
          .filter((s) => s.produto_id === produto.id && (s.quantidade || 0) > 0)
          .map((s) => depositos?.find((d) => d.id === s.deposito_id))
          .filter(Boolean)
      : homeDep
      ? [homeDep]
      : [];
  const depMatch = (rest) =>
    depsComSaldo.some((dep) => {
      const num = (dep.numero || '').toLowerCase();
      const nome = (dep.nome || '').toLowerCase();
      if (!rest) return Boolean(num || nome);
      if (rest.endsWith('*')) {
        const exato = rest.slice(0, -1).trim();
        return num === exato || nome === exato;
      }
      return num.includes(rest) || nome.includes(rest);
    });

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

  // "deposito <num>" → busca por depósito (baseado nos saldos reais)
  if (t.startsWith('deposito') || t.startsWith('depósito')) {
    const rest = t.replace(/^dep[oó]sito\s*/, '').trim();
    return depMatch(rest);
  }

  return (
    (produto.nome || '').toLowerCase().includes(t) ||
    (produto.codigo || '').toLowerCase().includes(t) ||
    (produto.codigo_referencia || '').toLowerCase().includes(t) ||
    nomeMaquina.includes(t) ||
    codigoGaveta.includes(t) ||
    descGaveta.includes(t) ||
    // corresponde se o produto tiver saldo em algum depósito cujo nº/nome bata
    depsComSaldo.some((dep) => (dep.numero || '').toLowerCase().includes(t) || (dep.nome || '').toLowerCase().includes(t))
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