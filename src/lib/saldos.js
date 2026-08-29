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

// valor_total de uma parcela = quantidade × custo_unitario.
function valorParcela(saldo) {
  return (Number(saldo?.quantidade) || 0) * (Number(saldo?.custo_unitario) || 0);
}

// Persiste quantidade + valor_total de uma parcela.
async function persistSaldo(saldo) {
  const novaQtd = Number(saldo.quantidade) || 0;
  const custo = Number(saldo.custo_unitario) || 0;
  await base44.entities.SaldoEstoque.update(saldo.id, {
    quantidade: novaQtd,
    custo_unitario: custo,
    valor_total: Math.round(novaQtd * custo * 100) / 100,
  });
}

// Encontra saldo existente ou cria um novo para a combinação produto+depósito+gaveta+lote.
export async function getOrCreateSaldo({ produtoId, depositoId, gavetaId = '', loteId = '', unidade = 'un', custoUnitario = 0, saldos }) {
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
    custo_unitario: Number(custoUnitario) || 0,
    valor_total: 0,
    unidade,
  });
  saldos?.push(created);
  return created;
}

// Entrada: adiciona quantidade a um saldo (cria se não existir). Suporta custo unitário.
export async function entrarSaldo({ produto, depositoId, gavetaId = '', loteId = '', quantidade, custoUnitario, unidade = 'un', saldos }) {
  if (!depositoId) throw new Error('DEPOSITO_OBRIGATORIO');
  const custo = Number(custoUnitario) || 0;
  const saldo = await getOrCreateSaldo({ produtoId: produto.id, depositoId, gavetaId, loteId, unidade, custoUnitario: custo, saldos });
  // Se a parcela é nova (sem custo) e veio um custo, assume-o; senão mantém o existente.
  if (!saldo.custo_unitario && custo) saldo.custo_unitario = custo;
  saldo.quantidade = (Number(saldo.quantidade) || 0) + Number(quantidade);
  await persistSaldo(saldo);
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
    saldo.quantidade = disp - consumo;
    await persistSaldo(saldo);
    consumidos.push({ saldo_id: saldo.id, lote_id: saldo.lote_id || '', quantidade: consumo, custo_unitario: saldo.custo_unitario || 0 });
    restante -= consumo;
  }

  await recalcProdutoQuantidade(produto.id, saldos);
  return { consumidos, totalDisponivel, suficiente: restante <= 0 };
}

// Reverte o efeito de uma movimentação no saldo (incluindo o valor financeiro).
export async function reverterSaldoMov(mov, { saldos }) {
  const produtoId = mov.produto_id;
  const depositoId = mov.deposito_id;
  const gavetaId = mov.gaveta_id || '';
  const custo = Number(mov.custo_unitario) || 0;

  if (mov.tipo === 'entrada') {
    // Reverte entrada: remove do saldo (mesmo custo da entrada)
    const saldo = (saldos || []).find(
      (s) =>
        s.produto_id === produtoId &&
        s.deposito_id === depositoId &&
        (s.gaveta_id || '') === gavetaId &&
        (s.lote_id || '') === (mov.lote_id || '')
    );
    if (saldo) {
      saldo.quantidade = Math.max(0, (saldo.quantidade || 0) - (mov.quantidade || 0));
      await persistSaldo(saldo);
    }
  } else {
    // Reverte saída: devolve ao saldo (preservando custo da parcela consumida)
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
        custoUnitario: Number(c.custo_unitario) || custo,
        saldos,
      });
      saldo.quantidade = (saldo.quantidade || 0) + (c.quantidade || 0);
      await persistSaldo(saldo);
    }
  }

  await recalcProdutoQuantidade(produtoId, saldos);
  return { produto: { id: produtoId } };
}

// Transferência interna entre depósitos: consome do saldo de origem (FEFO)
// e adiciona ao saldo de destino, preservando lotes.
// Retorna { consumidos, totalDisponivel }.
export async function transferirSaldo({ produto, depositoOrigemId, gavetaOrigemId = '', depositoDestinoId, gavetaDestinoId = '', quantidade, lotes = [], saldos }) {
  if (!depositoOrigemId || !depositoDestinoId) throw new Error('DEPOSITO_OBRIGATORIO');
  if (depositoOrigemId === depositoDestinoId && (gavetaOrigemId || '') === (gavetaDestinoId || ''))
    throw new Error('ORIGEM_DESTINO_IGUAIS');

  const lotesProduto = (lotes || []).filter((l) => l.produto_id === produto.id);

  // 1. Sair do depósito de origem (FEFO)
  const { consumidos } = await sairSaldo({
    produto, depositoId: depositoOrigemId, gavetaId: gavetaOrigemId, quantidade, lotes: lotesProduto, saldos,
  });

  // 2. Entrar no depósito de destino (preservando lotes)
  for (const c of consumidos) {
    await entrarSaldo({
      produto, depositoId: depositoDestinoId, gavetaId: gavetaDestinoId, loteId: c.lote_id || '',
      quantidade: c.quantidade, unidade: produto.unidade || 'un', saldos,
    });

    // Se o lote zerou na origem, atualiza depósito/gaveta do lote para o destino
    if (c.lote_id) {
      const saldoOrigem = (saldos || []).find(
        (s) => s.produto_id === produto.id && s.deposito_id === depositoOrigemId && s.lote_id === c.lote_id
      );
      if (!saldoOrigem || (saldoOrigem.quantidade || 0) <= 0) {
        const lote = lotesProduto.find((l) => l.id === c.lote_id);
        if (lote) {
          await base44.entities.Lote.update(lote.id, {
            deposito_id: depositoDestinoId,
            gaveta_id: gavetaDestinoId || '',
          });
          lote.deposito_id = depositoDestinoId;
          lote.gaveta_id = gavetaDestinoId || '';
        }
      }
    }
  }

  return { consumidos };
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

// Saldo total real do produto (soma das parcelas em SaldoEstoque).
export function saldoTotalProduto(produtoId, saldos = []) {
  return (saldos || [])
    .filter((s) => s.produto_id === produtoId && (s.quantidade || 0) > 0)
    .reduce((sum, s) => sum + (s.quantidade || 0), 0);
}

// Depósitos onde o produto possui saldo positivo.
export function depositosComSaldoDoProduto(produtoId, saldos = [], depositos = []) {
  const depIds = new Set(
    (saldos || [])
      .filter((s) => s.produto_id === produtoId && (s.quantidade || 0) > 0)
      .map((s) => s.deposito_id)
      .filter(Boolean)
  );
  return (depositos || []).filter((d) => depIds.has(d.id));
}

// Gavetas onde o produto possui saldo positivo dentro de um depósito.
export function gavetasComSaldoDoProduto(produtoId, depositoId, saldos = [], gavetas = []) {
  const gavIds = new Set(
    (saldos || [])
      .filter(
        (s) =>
          s.produto_id === produtoId &&
          s.deposito_id === depositoId &&
          (s.quantidade || 0) > 0
      )
      .map((s) => s.gaveta_id)
      .filter(Boolean)
  );
  return (gavetas || []).filter((g) => gavIds.has(g.id));
}

// Valor total de um produto = Σ (parcela.quantidade × parcela.custo_unitario).
export function valorTotalProduto(produtoId, saldos = []) {
  return (saldos || [])
    .filter((s) => s.produto_id === produtoId && (s.quantidade || 0) > 0)
    .reduce((sum, s) => sum + valorParcela(s), 0);
}

// Valor consolidado por produto, depósito, setor e total da empresa.
// `produtos` resolve produto_id → setor_id para o agrupamento por setor.
export function valorEstoqueConsolidado(saldos = [], produtos = [], depositos = []) {
  const ativos = (saldos || []).filter((s) => (s.quantidade || 0) > 0);
  let totalGeral = 0;
  const porProduto = {};
  const porDeposito = {};
  const porSetor = {};

  for (const s of ativos) {
    const valor = valorParcela(s);
    totalGeral += valor;
    porProduto[s.produto_id] = (porProduto[s.produto_id] || 0) + valor;
    const depKey = s.deposito_id || '_sem_deposito';
    porDeposito[depKey] = (porDeposito[depKey] || 0) + valor;
    const produto = produtos.find((p) => p.id === s.produto_id);
    const setorKey = produto?.setor_id || '_sem_setor';
    porSetor[setorKey] = (porSetor[setorKey] || 0) + valor;
  }

  return { totalGeral, porProduto, porDeposito, porSetor };
}