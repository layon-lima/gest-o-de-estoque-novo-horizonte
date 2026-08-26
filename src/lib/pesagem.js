// Utilitários do módulo de Pesagem Rodoviária.
import { parseQtd } from '@/lib/format';

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

// Calcula peso líquido: bruto - tara.
export function calcLiquido(bruto, tara) {
  return round3(parseQtd(bruto) - parseQtd(tara));
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