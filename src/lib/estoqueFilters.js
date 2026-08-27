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
  // SAP: se NENHUM depósito/gaveta estiver filtrado (Todos), mostra UMA linha
  // por produto com o saldo total e marca "_todos" p/ a coluna exibir "Todos".
  // Se um depósito/gaveta estiver selecionado, expande em uma linha por parcela
  // (saldo) dentro do filtro, cada uma com sua quantidade.
  const hasSaldos = (saldos || []).length > 0;
  const expandir = !!(filtros.deposito_id || filtros.gaveta_id);

  let rows;
  if (hasSaldos) {
    rows = [];
    for (const p of produtos) {
      const parcelas = (saldos || []).filter(
        (s) => s.produto_id === p.id && (s.quantidade || 0) > 0
      );
      if (expandir) {
        for (const s of parcelas) {
          rows.push({
            ...p,
            quantidade: s.quantidade,
            unidade: s.unidade || p.unidade,
            deposito_id: s.deposito_id || p.deposito_id,
            gaveta_id: s.gaveta_id || '',
            lote_id: s.lote_id || '',
            _rowKey: `${p.id}:${s.deposito_id || ''}:${s.gaveta_id || ''}:${s.lote_id || ''}:${s.id}`,
          });
        }
      } else {
        const total = parcelas.reduce((sum, s) => sum + (s.quantidade || 0), 0);
        rows.push({ ...p, quantidade: total, _todos: true, _rowKey: `total:${p.id}` });
      }
    }
  } else {
    rows = produtos.map((p) => ({ ...p, _rowKey: p.id }));
  }

  let result = rows;
  if (filtros.setor_id) result = result.filter((p) => p.setor_id === filtros.setor_id);
  if (filtros.deposito_id) result = result.filter((p) => p.deposito_id === filtros.deposito_id);
  if (filtros.gaveta_id) result = result.filter((p) => p.gaveta_id === filtros.gaveta_id);
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