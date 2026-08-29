// Utilitários do módulo de Pesagem Rodoviária.
import { base44 } from '@/api/base44Client';
import { parseQtd } from '@/lib/format';
import { sairSaldo } from '@/lib/saldos';
import { maxNumeroMovimento, formatarNumeroMov } from '@/lib/movimentacoes';
import { invalidateEntidade } from '@/lib/useEntidades';

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
export async function fecharTicket({ ticket, pesoBruto, isInverted, liquido, isVenda, pedidoId, transportadoraId, observacao, pedidoSel, clienteNome, transpNome, produtos }) {
  const semLimite = isVenda && pedidoSel?.sem_limite;
  const novoSaldo = (!semLimite && pedidoSel) ? Math.round((Number(pedidoSel.saldo_kg) - liquido) * 1000) / 1000 : (pedidoSel?.saldo_kg || 0);

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
    if (!semLimite) {
      await base44.entities.PedidoPesagem.update(pedidoId, {
        saldo_kg: novoSaldo,
        status: novoSaldo <= 0 ? 'concluido' : 'aberto',
      });
    }
    const prodVenda = produtos.find((p) => p.id === pedidoSel.produto_id);
    if (prodVenda) {
      try {
        await baixarEstoqueVendaTicket({ produto: prodVenda, quantidadeKg: liquido, ticketNumero: ticket.numero });
      } catch (e) {
        baixaError = String(e?.message || e);
      }
    }
  }

  // Invalida caches para a UI refletir imediatamente
  invalidateEntidade('TicketPesagem');
  invalidateEntidade('PedidoPesagem');
  if (isVenda && pedidoSel) {
    invalidateEntidade('SaldoEstoque');
    invalidateEntidade('Movimentacao');
    invalidateEntidade('Lote');
    invalidateEntidade('Produto');
  }

  return { ticket: closedTicket, baixaError };
}

// Quebra um ticket em dois quando o peso excede o saldo do pedido original.
// O ticket original é ajustado para fechar o pedido exatamente (liquido = saldo_kg),
// e o excedente vira um novo ticket vinculado ao novo pedido escolhido pelo usuário.
export async function quebrarTicket({ ticket, pesoBruto, isInverted, liquido, pedidoSel, novoPedido, transportadoraId, observacao, clienteNome, transpNome, produtos, tickets }) {
  if (!ticket?.id) throw new Error('Ticket inválido para quebra.');
  const secondWeight = parseQtd(pesoBruto);
  const firstWeight = Number(ticket.peso_tara) || 0;
  const saldoOriginal = Number(pedidoSel.saldo_kg) || 0;
  const liquidoExcesso = round3(liquido - saldoOriginal);

  // O ticket ORIGINAL mantém sempre a tara original; o COMPLEMENTAR mantém o bruto original.
  // O ponto de divisão entre os dois depende de qual campo é o maior (carga vs. vazio):
  //   - tara > bruto (carga registrada no campo tara): divisão = tara - saldo
  //   - bruto > tara (caso normal, carga no bruto):     divisão = tara + saldo
  const heavierInTara = firstWeight >= (Number(ticket.peso_bruto) || 0);
  const splitPoint = heavierInTara
    ? round3(firstWeight - saldoOriginal)
    : round3(firstWeight + saldoOriginal);

  // Ticket original: fecha o pedido exatamente (líquido = saldo), mantém a tara original.
  const pesosOriginal = { peso_tara: firstWeight, peso_bruto: splitPoint, peso_liquido: saldoOriginal };

  // Ticket complementar: o restante do peso, mantém o bruto original.
  const pesosNovo = { peso_tara: splitPoint, peso_bruto: secondWeight, peso_liquido: liquidoExcesso };

  const now = new Date().toISOString();
  const transpId = transportadoraId || (pedidoSel.transportadora_ids || '').split(',')[0]?.trim() || '';
  const transpNm = transpId ? transpNome(transpId) : (ticket.transportadora_nome || '');

  // 1. Atualiza o ticket original com os pesos ajustados
  const updateOriginal = {
    ...pesosOriginal,
    pedido_id: pedidoSel.id,
    produto_id: pedidoSel.produto_id,
    cliente_id: pedidoSel.cliente_id,
    cliente_nome: clienteNome(pedidoSel.cliente_id),
    transportadora_id: transpId,
    transportadora_nome: transpNm,
    status: 'fechado',
    data_fechamento: now,
    observacao: observacao || '',
  };
  await base44.entities.TicketPesagem.update(ticket.id, updateOriginal);
  const closedOriginal = { ...ticket, ...updateOriginal };

  // 2. Cria o novo ticket complementar — número gerado de uma listagem FRESCA do banco
  //    para evitar colisão com tickets criados concorrentemente (lista em cache pode estar desatualizada).
  let novoNumero;
  try {
    const freshTickets = await base44.entities.TicketPesagem.list('-created_date', 200);
    novoNumero = nextTicketNumber(freshTickets);
  } catch {
    novoNumero = nextTicketNumber(tickets || []);
  }
  const novoTicket = await base44.entities.TicketPesagem.create({
    numero: novoNumero,
    tipo: 'venda',
    produto_id: pedidoSel.produto_id,
    cliente_id: pedidoSel.cliente_id,
    cliente_nome: clienteNome(pedidoSel.cliente_id),
    transportadora_id: transpId,
    transportadora_nome: transpNm,
    origem: ticket.origem || '',
    destino: ticket.destino || '',
    data_abertura: ticket.data_abertura,
    data_fechamento: now,
    motorista: ticket.motorista,
    placa: ticket.placa,
    ...pesosNovo,
    pedido_id: novoPedido.id,
    status: 'fechado',
    observacao: `complemento do ticket ${ticket.numero}${observacao ? ' — ' + observacao : ''}`,
  });

  // 3. Atualiza os pedidos
  if (!pedidoSel.sem_limite) {
    await base44.entities.PedidoPesagem.update(pedidoSel.id, {
      saldo_kg: 0,
      status: 'concluido',
    });
  }
  if (!novoPedido.sem_limite) {
    const novoSaldo = round3((Number(novoPedido.saldo_kg) || 0) - liquidoExcesso);
    await base44.entities.PedidoPesagem.update(novoPedido.id, {
      saldo_kg: novoSaldo,
      status: novoSaldo <= 0 ? 'concluido' : 'aberto',
    });
  }

  // 4. Baixa estoque para ambos os tickets
  const prodVenda = produtos.find((p) => p.id === pedidoSel.produto_id);
  let baixaErrorOriginal = null;
  let baixaErrorNovo = null;

  if (prodVenda) {
    try {
      await baixarEstoqueVendaTicket({ produto: prodVenda, quantidadeKg: saldoOriginal, ticketNumero: ticket.numero });
    } catch (e) {
      baixaErrorOriginal = String(e?.message || e);
    }
    try {
      await baixarEstoqueVendaTicket({ produto: prodVenda, quantidadeKg: liquidoExcesso, ticketNumero: novoNumero });
    } catch (e) {
      baixaErrorNovo = String(e?.message || e);
    }
  }

  invalidateEntidade('TicketPesagem');
  invalidateEntidade('PedidoPesagem');
  invalidateEntidade('SaldoEstoque');
  invalidateEntidade('Movimentacao');
  invalidateEntidade('Lote');
  invalidateEntidade('Produto');

  return { ticketOriginal: closedOriginal, ticketNovo: novoTicket, baixaErrorOriginal, baixaErrorNovo };
}