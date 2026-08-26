// Operações de saldo multi-depósito (modelo SAP).
// O estoque é rastreado pela entidade SaldoEstoque (Produto + Depósito + Gaveta + Lote).
// Produto.quantidade é sempre a soma de todos os saldos do produto.
import { base44 } from '@/api/base44Client';

// Recalcula Produto.quantidade = soma de todos os saldos do produto.
// `saldos` é o array local (mutado para refletir o novo estado).
export async function recalcProdutoQuantidade(produtoId, saldos) {
  const saldosProduto = (saldos || []).filter((s) => s.produto_id === produtoId);
  const total = saldosProduto.reduce((s, sl) => s + (sl.quantidade || 0), 0);
  await base44.entities.Produto.update(produtoId, { quantidade: total });
  return total;
}

// Encontra saldo existente ou cria um novo para a combinação produto+depósito+gaveta+lote.
export async function getOrCreateSaldo({ produtoId, depositoId, gavetaId = '', loteId = '', unidade = 'un', saldos }) {
  const existing = (saldos || []).find(
    (s) =>
      s.produto_id === produtoId &&
      s.deposito_id === depositoId &&
      (s.gaveta_id || '') === (gavetaId || '') &&
      (s.lote_id || '') === (loteId || '')
  );
  if (existing) return existing;
  const created = await base44.entities.SaldoEstoque.create({
    produto_id: produtoId,
    deposito_id: depositoId,
    gaveta_id: gavetaId || '',
    lote_id: loteId || '',
    quantidade: 0,
    unidade,
  });
  saldos?.push(created);
  return created;
}

// Entrada: adiciona quantidade a um saldo (cria se não existir).
export async function entrarSaldo({ produto, depositoId, gavetaId = '', loteId = '', quantidade, unidade = 'un', saldos }) {
  if (!depositoId) throw new Error('DEPOSITO_OBRIGATORIO');
  const saldo = await getOrCreateSaldo({ produtoId: produto.id, depositoId, gavetaId, loteId, unidade, saldos });
  const novaQtd = (saldo.quantidade || 0) + quantidade;
  await base44.entities.SaldoEstoque.update(saldo.id, { quantidade: novaQtd });
  saldo.quantidade = novaQtd;
  await recalcProdutoQuantidade(produto.id, saldos);
  return saldo;
}

// Saída: consome quantidade de saldos (FEFO quando há lotes).
// Retorna { consumidos, totalDisponivel, suficiente }.
export async function sairSaldo({ produto, depositoId, gavetaId = '', quantidade, lotes = [], saldos }) {
  if (!depositoId) throw new Error('DEPOSITO_OBRIGATORIO');
  let relevantes = (saldos || []).filter(
    (s) =>
      s.produto_id === produto.id &&
      s.deposito_id === depositoId &&
      (s.gaveta_id || '') === (gavetaId || '') &&
      (s.quantidade || 0) > 0
  );

  // FEFO: se há lotes com validade, ordena por validade crescente
  if (lotes.length > 0) {
    relevantes = relevantes
      .map((s) => ({ saldo: s, lote: lotes.find((l) => l.id === s.lote_id) }))
      .sort((a, b) => {
        const va = a.lote?.data_validade ? new Date(a.lote.data_validade).getTime() : Infinity;
        const vb = b.lote?.data_validade ? new Date(b.lote.data_validade).getTime() : Infinity;
        return va - vb;
      })
      .map((x) => x.saldo);
  }

  const totalDisponivel = relevantes.reduce((s, sl) => s + (sl.quantidade || 0), 0);
  if (totalDisponivel < quantidade) {
    throw new Error(`SALDO_INSUFICIENTE:${totalDisponivel}`);
  }

  let restante = quantidade;
  const consumidos = [];
  for (const saldo of relevantes) {
    if (restante <= 0) break;
    const disp = saldo.quantidade || 0;
    const consumo = Math.min(disp, restante);
    const novaQtd = disp - consumo;
    await base44.entities.SaldoEstoque.update(saldo.id, { quantidade: novaQtd });
    saldo.quantidade = novaQtd;
    consumidos.push({ saldo_id: saldo.id, lote_id: saldo.lote_id || '', quantidade: consumo });
    restante -= consumo;
  }

  await recalcProdutoQuantidade(produto.id, saldos);
  return { consumidos, totalDisponivel, suficiente: restante <= 0 };
}

// Reverte o efeito de uma movimentação no saldo.
export async function reverterSaldoMov(mov, { saldos }) {
  const produtoId = mov.produto_id;
  const depositoId = mov.deposito_id;
  const gavetaId = mov.gaveta_id || '';

  if (mov.tipo === 'entrada') {
    // Reverte entrada: remove do saldo
    const saldo = (saldos || []).find(
      (s) =>
        s.produto_id === produtoId &&
        s.deposito_id === depositoId &&
        (s.gaveta_id || '') === gavetaId &&
        (s.lote_id || '') === (mov.lote_id || '')
    );
    if (saldo) {
      const novaQtd = Math.max(0, (saldo.quantidade || 0) - (mov.quantidade || 0));
      await base44.entities.SaldoEstoque.update(saldo.id, { quantidade: novaQtd });
      saldo.quantidade = novaQtd;
    }
  } else {
    // Reverte saída: devolve ao saldo
    const consumidos = mov.lotes_consumidos
      ? JSON.parse(mov.lotes_consumidos)
      : [{ lote_id: mov.lote_id || '', quantidade: mov.quantidade }];
    for (const c of consumidos) {
      const saldo = await getOrCreateSaldo({
        produtoId,
        depositoId,
        gavetaId,
        loteId: c.lote_id || '',
        unidade: 'un',
        saldos,
      });
      const novaQtd = (saldo.quantidade || 0) + (c.quantidade || 0);
      await base44.entities.SaldoEstoque.update(saldo.id, { quantidade: novaQtd });
      saldo.quantidade = novaQtd;
    }
  }

  await recalcProdutoQuantidade(produtoId, saldos);
  return { produto: { id: produtoId } };
}

// Constrói árvore hierárquica: produto → depósitos → gavetas → lotes
export function buildEstoqueTree(produtoId, { saldos = [], depositos = [], gavetas = [], lotes = [] }) {
  const saldosProduto = saldos.filter((s) => s.produto_id === produtoId && (s.quantidade || 0) > 0);
  const tree = {};
  for (const s of saldosProduto) {
    const dep = depositos.find((d) => d.id === s.deposito_id);
    const depKey = s.deposito_id || '_sem_deposito';
    if (!tree[depKey]) {
      tree[depKey] = {
        deposito_id: s.deposito_id || '',
        nome: dep?.numero ? `${dep.numero}${dep.nome ? ' · ' + dep.nome : ''}` : 'Sem depósito',
        quantidade: 0,
        gavetas: {},
      };
    }
    tree[depKey].quantidade += s.quantidade || 0;
    const gavKey = s.gaveta_id || '_sem_gaveta';
    if (!tree[depKey].gavetas[gavKey]) {
      const gav = gavetas.find((g) => g.id === s.gaveta_id);
      tree[depKey].gavetas[gavKey] = {
        gaveta_id: s.gaveta_id || '',
        nome: gav?.codigo || 'Sem gaveta',
        quantidade: 0,
        lotes: [],
      };
    }
    tree[depKey].gavetas[gavKey].quantidade += s.quantidade || 0;
    const lote = lotes.find((l) => l.id === s.lote_id);
    tree[depKey].gavetas[gavKey].lotes.push({
      saldo_id: s.id,
      lote_id: s.lote_id || '',
      codigo_lote: lote?.codigo_lote || '',
      data_validade: lote?.data_validade || '',
      quantidade: s.quantidade || 0,
      unidade: s.unidade || 'un',
    });
  }
  return Object.values(tree).map((dep) => ({
    ...dep,
    gavetas: Object.values(dep.gavetas),
  }));
}