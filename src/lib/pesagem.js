// Utilitários do módulo de Pesagem Rodoviária.
import { base44 } from '@/api/base44Client';
import { parseQtd } from '@/lib/format';
import { sairSaldo } from '@/lib/saldos';
import { maxNumeroMovimento, formatarNumeroMov } from '@/lib/movimentacoes';
import { isOnline, enqueue, genId, emitChange, isNetworkError } from '@/lib/offlineCore';
import { queryClientInstance } from '@/lib/query-client';

// Normaliza placa: uppercase, sem hífen/espaços (ex.: "ABC-1234" -> "ABC1234").
export function normalizePlaca(placa) {
  return String(placa || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// Formata placa para exibição no padrão Mercosul/antigo conforme o tamanho.
export function formatPlaca(placa) {
  const norm = normalizePlaca(placa);
  if (norm.length === 7) {
    return `${norm.slice(0, 3)}-${norm.slice(3)}`;
  }
  return norm;
}

// Gera o próximo número sequencial de ticket (PES-000001) com base na lista existente.
export function nextTicketNumber(tickets = []) {
  let max = 0;
  tickets.forEach((t) => {
    const m = String(t.numero || '').match(/PES-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `PES-${String(max + 1).padStart(6, '0')}`;
}

// Gera o próximo número sequencial de pagamento (PAG-000001) com base na lista existente.
export function nextPagamentoNumber(pagamentos = []) {
  let max = 0;
  pagamentos.forEach((p) => {
    const m = String(p.numero || '').match(/PAG-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `PAG-${String(max + 1).padStart(6, '0')}`;
}

// Gera o próximo número sequencial de pedido (PED-000001) com base na lista existente.
export function nextPedidoNumber(pedidos = []) {
  let max = 0;
  pedidos.forEach((p) => {
    const m = String(p.numero || '').match(/PED-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `PED-${String(max + 1).padStart(6, '0')}`;
}

// Calcula total em kg: qtd_sacas * peso_saca_kg.
export function calcTotalKg(qtdSacas, pesoSacaKg) {
  return round3(parseQtd(qtdSacas) * parseQtd(pesoSacaKg));
}

// Calcula valor total: qtd_sacas * valor_saca.
export function calcValorTotal(qtdSacas, valorSaca) {
  return round3(parseQtd(qtdSacas) * parseQtd(valorSaca));
}

// Calcula peso líquido: |bruto - tara| (sempre positivo, independente da ordem de pesagem).
export function calcLiquido(bruto, tara) {
  return round3(Math.abs(parseQtd(bruto) - parseQtd(tara)));
}

export function round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

// Soma o peso líquido dos tickets vinculados a um pedido.
export function somaLiquidoTickets(tickets = [], pedidoId) {
  return (tickets || [])
    .filter((t) => t.pedido_id === pedidoId)
    .reduce((acc, t) => acc + (Number(t.peso_liquido) || 0), 0);
}

// Define o status do pedido com base no saldo (kg) restante, preservando 'cancelado'.
export function statusPorSaldo(saldoKg, totalKg, statusAtual) {
  if (statusAtual === 'cancelado') return 'cancelado';
  const saldo = Number(saldoKg) || 0;
  const total = Number(totalKg) || 0;
  return total > 0 && saldo <= 0 ? 'concluido' : 'aberto';
}

// Formata kg para exibição — sempre em kg (sem converter para toneladas).
export function formatKg(n) {
  const num = Number(n) || 0;
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`;
}

export function formatMoeda(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Baixa o saldo real (SaldoEstoque — origem da verdade, FEFO quando há lotes)
// do produto vendido ao fechar um ticket de VENDA. Cria a movimentação de
// saída vinculada ao ticket. Autocontida: carrega saldos/lotes/movimentações.
// Retorna { mov, consumidos, totalDisponivel, suficiente }.
// Lança 'DEPOSITO_OBRIGATORIO' quando não houver depósito nem saldo.
export async function baixarEstoqueVendaTicket({ produto, quantidadeKg, ticketNumero }) {
  const qtd = parseQtd(quantidadeKg);
  if (!(qtd > 0) || !produto?.id) return null;

  const saldos = await base44.entities.SaldoEstoque.filter({ produto_id: produto.id });
  const depositoId = produto.deposito_id || saldos.find((s) => (s.quantidade || 0) > 0)?.deposito_id || '';
  if (!depositoId) throw new Error('DEPOSITO_OBRIGATORIO');
  const gavetaId = produto.gaveta_id || '';

  const lotes = await base44.entities.Lote.filter({ produto_id: produto.id });
  const lotesProduto = (lotes || []).filter((l) => l.produto_id === produto.id);

  const { consumidos, totalDisponivel, suficiente } = await sairSaldo({
    produto,
    depositoId,
    gavetaId,
    quantidade: qtd,
    lotes: lotesProduto,
    saldos,
  });
  if (!suficiente) throw new Error(`SALDO_INSUFICIENTE:${totalDisponivel}`);

  // Atualiza lotes (denormalizado, para compatibilidade das views de validade).
  for (const c of consumidos) {
    const l = lotesProduto.find((x) => x.id === c.lote_id);
    if (l) {
      const novaQtdLote = (l.quantidade || 0) - c.quantidade;
      await base44.entities.Lote.update(l.id, {
        quantidade: novaQtdLote,
        ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}),
      });
    }
  }

  const movimentacoes = await base44.entities.Movimentacao.list('-created_date', 100);
  const primeiroLote = lotesProduto.find((l) => l.id === consumidos[0]?.lote_id);
  const mov = await base44.entities.Movimentacao.create({
    data: new Date().toISOString(),
    numero: formatarNumeroMov(maxNumeroMovimento(movimentacoes) + 1),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: qtd,
    setor_id: produto.setor_id,
    deposito_id: depositoId,
    maquina_id: produto.maquina_id || '',
    gaveta_id: gavetaId,
    tipo: 'saida',
    observacao: `Venda — Ticket ${ticketNumero || ''}`,
    lote_id: consumidos[0]?.lote_id || '',
    data_validade: primeiroLote?.data_validade || '',
    lotes_consumidos: JSON.stringify(consumidos),
  });

  return { mov, consumidos, totalDisponivel, suficiente };
}

// Fecha um ticket de pesagem: atualiza o ticket, o pedido (venda) e baixa o estoque.
// Função reutilizável extraída do componente FechamentoTicketDialog — usada tanto
// no fluxo online quanto no replay de sincronização offline.
export async function fecharTicket({ ticket, pesoBruto, isInverted, liquido, isVenda, pedidoId, transportadoraId, observacao, pedidoSel, clienteNome, transpNome, produtos }) {
  const novoSaldo = pedidoSel ? Math.round((Number(pedidoSel.saldo_kg) - liquido) * 1000) / 1000 : 0;

  const updateData = {
    peso_tara: isInverted ? parseQtd(pesoBruto) : (ticket.peso_tara || 0),
    peso_bruto: isInverted ? (ticket.peso_bruto || 0) : parseQtd(pesoBruto),
    peso_liquido: liquido,
    pedido_id: isVenda ? pedidoId : '',
    produto_id: isVenda && pedidoSel ? pedidoSel.produto_id : (ticket.produto_id || ''),
    cliente_id: isVenda && pedidoSel ? pedidoSel.cliente_id : (ticket.cliente_id || ''),
    cliente_nome: isVenda && pedidoSel ? clienteNome(pedidoSel.cliente_id) : (ticket.cliente_nome || ''),
    transportadora_id: transportadoraId,
    transportadora_nome: transportadoraId ? transpNome(transportadoraId) : (ticket.transportadora_nome || ''),
    status: 'fechado',
    data_fechamento: new Date().toISOString(),
    observacao: observacao || '',
  };

  await base44.entities.TicketPesagem.update(ticket.id, updateData);

  const closedTicket = { ...ticket, ...updateData };
  let baixaError = null;

  if (isVenda && pedidoSel) {
    await base44.entities.PedidoPesagem.update(pedidoId, {
      saldo_kg: novoSaldo,
      status: novoSaldo <= 0 ? 'concluido' : 'aberto',
    });
    const prodVenda = produtos.find((p) => p.id === pedidoSel.produto_id);
    if (prodVenda) {
      try {
        await baixarEstoqueVendaTicket({ produto: prodVenda, quantidadeKg: liquido, ticketNumero: ticket.numero });
      } catch (e) {
        baixaError = String(e?.message || e);
      }
    }
  }

  return { ticket: closedTicket, baixaError };
}

// Versão offline-aware de fecharTicket: se online, executa normalmente;
// se offline, enfileira a operação composta e faz atualização otimista.
export async function offlineFecharTicket(params) {
  if (isOnline()) {
    try {
      return await fecharTicket(params);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  // Offline: enfileira operação composta
  await enqueue({
    id: genId(),
    type: 'compound',
    compoundType: 'fechar_ticket',
    compoundData: {
      ticketId: params.ticket.id,
      pesoBruto: params.pesoBruto,
      isInverted: params.isInverted,
      liquido: params.liquido,
      isVenda: params.isVenda,
      pedidoId: params.pedidoId,
      transportadoraId: params.transportadoraId,
      observacao: params.observacao,
    },
    timestamp: Date.now(),
  });
  // Atualização otimista: marca ticket como fechado
  const closedTicket = {
    ...params.ticket,
    status: 'fechado',
    peso_liquido: params.liquido,
    data_fechamento: new Date().toISOString(),
    _pending: true,
  };
  queryClientInstance.setQueriesData({ queryKey: ['ent', 'TicketPesagem'] }, (old) => {
    if (!old) return old;
    return old.map((t) => (t.id === params.ticket.id ? closedTicket : t));
  });
  emitChange();
  return { ticket: closedTicket, baixaError: null };
}