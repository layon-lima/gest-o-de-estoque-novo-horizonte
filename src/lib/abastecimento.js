import { base44 } from '@/api/base44Client';
import { setorControlaValidade } from '@/lib/lotes';
import { sairSaldo } from '@/lib/saldos';
import { maxNumeroMovimento, formatarNumeroMov } from '@/lib/movimentacoes';


// Localiza o setor de combustíveis pelo nome (contém "combust").
export function findSetorCombustivel(setores) {
  return (setores || []).find((s) =>
    String(s?.nome || '').toLowerCase().includes('combust')
  );
}

export function produtosCombustivel(produtos, setorId) {
  if (!setorId) return [];
  return (produtos || []).filter((p) => p.setor_id === setorId);
}

// Registra um abastecimento PENDENTE. Não baixa o estoque.
// A baixa só ocorre quando um usuário autorizado confirma (confirmarAbastecimento).
export async function registrarAbastecimentoPendente({
  maquina,
  produto,
  quantidade,
  observacao,
  operador,
  foto_url,
}) {
  const qtd = Number(quantidade);
  if (!(qtd > 0)) throw new Error('Informe uma quantidade maior que zero.');

  return base44.entities.Abastecimento.create({
    data: new Date().toISOString(),
    maquina_id: maquina.id,
    produto_id: produto.id,
    quantidade: qtd,
    unidade: produto.unidade || 'un',
    operador: operador || '',
    observacao: observacao || '',
    foto_url: foto_url || '',
    status: 'pendente',
  });
}

// Confirma a baixa de um abastecimento pendente: consome o saldo real
// (SaldoEstoque — origem da verdade, FEFO quando há lotes), cria a movimentação
// de saída vinculada à máquina e marca o abastecimento como confirmado.
// `saldos` é mutado localmente para refletir o novo estado.
export async function confirmarAbastecimento({
  abast,
  maquina,
  produto,
  confirmado_por,
  setores,
  lotes,
  saldos,
  movimentacoes,
}) {
  const qtd = Number(abast.quantidade);
  if (!(qtd > 0)) throw new Error('Quantidade inválida.');
  if (abast.status !== 'pendente') throw new Error('Este abastecimento já foi processado.');

  const controla = setorControlaValidade(produto.setor_id, setores);
  const depositoId = produto.deposito_id || '';
  const gavetaId = produto.gaveta_id || '';
  if (!depositoId) throw new Error('O combustível não possui um depósito definido. Defina o depósito no cadastro do produto.');

  const now = new Date().toISOString();
  const baseMov = {
    data: now,
    numero: formatarNumeroMov(maxNumeroMovimento(movimentacoes) + 1),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: qtd,
    setor_id: produto.setor_id,
    deposito_id: depositoId,
    maquina_id: maquina.id,
    gaveta_id: gavetaId,
    tipo: 'saida',
    modulo: 'abastecimento',
    observacao: abast.observacao || `Abastecimento — ${maquina.nome || maquina.codigo}`,
  };

  // Consome do saldo real (SaldoEstoque) — FEFO quando há lotes.
  const lotesProduto = (lotes || []).filter((l) => l.produto_id === produto.id);
  const { consumidos, totalDisponivel, suficiente } = await sairSaldo({
    produto,
    depositoId,
    gavetaId,
    quantidade: qtd,
    lotes: lotesProduto,
    saldos,
  });
  if (!suficiente) {
    throw new Error(`Saldo insuficiente. Disponível: ${totalDisponivel} ${produto.unidade || 'un'}.`);
  }

  // Atualiza lotes (denormalizado, para compatibilidade das views de validade).
  for (const c of consumidos) {
    const l = lotesProduto.find((x) => x.id === c.lote_id);
    if (l) {
      const novaQtdLote = (l.quantidade || 0) - c.quantidade;
      await base44.entities.Lote.update(l.id, {
        quantidade: novaQtdLote,
        ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}),
      });
      l.quantidade = novaQtdLote;
      if (novaQtdLote <= 0) l.gaveta_id = '';
    }
  }

  const primeiroLote = lotesProduto.find((l) => l.id === consumidos[0]?.lote_id);
  const mov = await base44.entities.Movimentacao.create({
    ...baseMov,
    lote_id: consumidos[0]?.lote_id || '',
    data_validade: primeiroLote?.data_validade || '',
    lotes_consumidos: controla ? JSON.stringify(consumidos) : '',
  });

  // Sincroniza produto localmente (sairSaldo já recalculou no banco).
  const saldosProduto = (saldos || []).filter((s) => s.produto_id === produto.id);
  produto.quantidade = saldosProduto.reduce((s, sl) => s + (sl.quantidade || 0), 0);
  if (produto.quantidade <= 0) produto.gaveta_id = '';

  await base44.entities.Abastecimento.update(abast.id, {
    status: 'confirmado',
    confirmado_por: confirmado_por || '',
    data_confirmacao: now,
    numero_mov: mov.numero || '',
  });
  return mov;
}

// Cancela um abastecimento pendente (sem baixar estoque).
export async function cancelarAbastecimento(abastId) {
  return base44.entities.Abastecimento.update(abastId, { status: 'cancelado' });
}