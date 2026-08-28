// Lógica de negócio das Ordens de Serviço de Aplicação (OS).
// Numeração sequencial, cálculo de previsto (dose × hectares),
// lançamento de consumo real com baixa de estoque (Movimentacao + SaldoEstoque).
import { base44 } from '@/api/base44Client';
import { parseQtd } from '@/lib/format';
import { sairSaldo } from '@/lib/saldos';
import { maxNumeroMovimento, formatarNumeroMov } from '@/lib/movimentacoes';

// Extrai o sufixo numérico de um número de OS (ex.: OSA-000012 -> 12).
export function maxNumeroOS(listaOS) {
  let max = 0;
  for (const o of listaOS || []) {
    const match = String(o?.numero || '').match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return max;
}

export function formatarNumeroOS(n) {
  return `OSA-${String(n).padStart(6, '0')}`;
}

// Calcula o previsto de um item: dose_por_hect × hectares.
export function calcularPrevisto(dosePorHect, hectares) {
  const dose = parseQtd(dosePorHect);
  const ha = Number(hectares) || 0;
  return dose * ha;
}

// Serializa/desserializa o array de itens da OS (armazenado como JSON string).
export function parseItens(itensStr) {
  if (!itensStr) return [];
  try {
    const arr = JSON.parse(itensStr);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function stringifyItens(itens) {
  return JSON.stringify(itens || []);
}

// Filtra produtos que podem ser usados em OS de aplicação:
// adubos/defensivos com saldo > 0. Para flexibilidade, considera qualquer
// produto com saldo positivo (o usuário escolhe quais adicionar na OS).
export function produtosParaAplicacao(produtos, saldos) {
  return (produtos || []).filter((p) => {
    const total = (saldos || [])
      .filter((s) => s.produto_id === p.id)
      .reduce((sum, s) => sum + (s.quantidade || 0), 0);
    return total > 0;
  });
}

// Saldo total de um produto.
export function saldoProduto(produtoId, saldos) {
  return (saldos || [])
    .filter((s) => s.produto_id === produtoId)
    .reduce((sum, s) => sum + (s.quantidade || 0), 0);
}

// Lança o consumo real da OS: para cada item, gera uma movimentação de saída
// e baixa o saldo (FEFO). Atualiza a OS com realizado, status e custo_total.
// `form` = { itens: [{ produto_id, realizado, deposito_id }] }.
// Lança 'SALDO_INSUFICIENTE:<disp>:<nome>' se faltar saldo.
export async function executarOS({ os, produtos, lotes, saldos, movimentacoes, responsavel }) {
  const itens = parseItens(os.itens);
  const now = new Date().toISOString();

  // Valida depósitos e saldos antes de qualquer mutação.
  for (const item of itens) {
    const produto = produtos.find((p) => p.id === item.produto_id);
    if (!produto) continue;
    const realizado = parseQtd(item.realizado);
    if (realizado <= 0) continue;
    const depositoId = item.deposito_id || produto.deposito_id || '';
    if (!depositoId) throw new Error(`DEPOSITO_OBRIGATORIO:${produto.nome}`);

    const lotesProduto = (lotes || []).filter((l) => l.produto_id === produto.id);
    const saldosProduto = (saldos || []).filter((s) => s.produto_id === produto.id && s.deposito_id === depositoId);
    const totalDisp = saldosProduto.reduce((s, sl) => s + (sl.quantidade || 0), 0);
    if (totalDisp < realizado) {
      throw new Error(`SALDO_INSUFICIENTE:${totalDisp}:${produto.nome}`);
    }
  }

  let baseNum = maxNumeroMovimento(movimentacoes) + 1;
  let custoTotal = 0;

  for (const item of itens) {
    const produto = produtos.find((p) => p.id === item.produto_id);
    if (!produto) continue;
    const realizado = parseQtd(item.realizado);
    if (realizado <= 0) continue;

    const depositoId = item.deposito_id || produto.deposito_id || '';
    const gavetaId = produto.gaveta_id || '';
    const lotesProduto = (lotes || []).filter((l) => l.produto_id === produto.id);

    const { consumidos } = await sairSaldo({
      produto,
      depositoId,
      gavetaId,
      quantidade: realizado,
      lotes: lotesProduto,
      saldos,
    });

    // Recalcula saldo do produto localmente.
    const novoSaldo = (saldos || [])
      .filter((s) => s.produto_id === produto.id)
      .reduce((s, sl) => s + (sl.quantidade || 0), 0);
    produto.quantidade = novoSaldo;

    const primeiroLote = lotesProduto.find((l) => l.id === consumidos[0]?.lote_id);

    await base44.entities.Movimentacao.create({
      data: now,
      numero: formatarNumeroMov(baseNum++),
      produto_id: produto.id,
      codigo: produto.codigo,
      nome_produto: produto.nome,
      quantidade: realizado,
      setor_id: produto.setor_id,
      deposito_id: depositoId,
      maquina_id: produto.maquina_id || '',
      gaveta_id: gavetaId,
      tipo: 'saida',
      observacao: `OS Aplicação ${os.numero} — ${os.lavoura_nome || ''}`,
      ...(consumidos.length ? { lotes_consumidos: JSON.stringify(consumidos), lote_id: consumidos[0]?.lote_id || '', data_validade: primeiroLote?.data_validade || '' } : {}),
    });

    // Custo do item: realizado × custo unitário.
    const custoUnit = Number(produto.custo_unitario) || 0;
    custoTotal += realizado * custoUnit;

    // Marca o item com realizado e custo.
    item.realizado = realizado;
    item.custo_unitario = custoUnit;
    item.custo_total = realizado * custoUnit;
    item.mov_numero = formatarNumeroMov(baseNum - 1);
  }

  // Atualiza a OS.
  await base44.entities.OrdemServicoAplicacao.update(os.id, {
    itens: stringifyItens(itens),
    status: 'executada',
    data_execucao: now,
    custo_total: custoTotal,
  });

  return { custoTotal };
}

// Calcula o custo detalhado de uma lavoura: agrega todas as OS executadas
// daquela lavoura, somando por produto o previsto, realizado e custo.
export function custoPorLavoura(lavouraId, ordens) {
  const ordensLavoura = (ordens || []).filter(
    (o) => o.lavoura_id === lavouraId && o.status === 'executada'
  );

  const porProduto = {};
  let custoTotalGeral = 0;

  for (const os of ordensLavoura) {
    const itens = parseItens(os.itens);
    for (const item of itens) {
      const realizado = Number(item.realizado) || 0;
      const previsto = Number(item.previsto) || 0;
      const custoUnit = Number(item.custo_unitario) || 0;
      const custo = Number(item.custo_total) || realizado * custoUnit;

      if (!porProduto[item.produto_id]) {
        porProduto[item.produto_id] = {
          produto_id: item.produto_id,
          nome: item.nome,
          codigo: item.codigo,
          unidade: item.unidade,
          previsto: 0,
          realizado: 0,
          custo: 0,
          qtd_os: 0,
        };
      }
      porProduto[item.produto_id].previsto += previsto;
      porProduto[item.produto_id].realizado += realizado;
      porProduto[item.produto_id].custo += custo;
      porProduto[item.produto_id].qtd_os += 1;
    }
    custoTotalGeral += Number(os.custo_total) || 0;
  }

  return {
    produtos: Object.values(porProduto).sort((a, b) => b.custo - a.custo),
    custoTotal: custoTotalGeral,
    qtdOS: ordensLavoura.length,
  };
}