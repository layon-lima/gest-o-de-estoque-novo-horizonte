// Geração do Ticket de Pesagem em PDF — layout "Painéis Agrupados".
import { jsPDF } from 'jspdf';

const LOGO_URL =
  'https://media.base44.com/images/public/6a84b445f638bd5605381437/708755ddd_ImagemdoWhatsAppde2025-01-17s153747_b380a23b.jpg';

const TIPO_LABEL = { venda: 'Venda', lavoura: 'Lavoura', avulsa: 'Avulsa' };

const TIPO_COLORS = {
  venda: { bg: [200, 230, 201], text: [26, 93, 26] },
  lavoura: { bg: [255, 243, 196], text: [141, 110, 0] },
  avulsa: { bg: [224, 224, 224], text: [66, 66, 66] },
};

const GREEN = [26, 93, 26];

async function loadLogoDataUrl() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtNum(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function drawScaleIcon(doc, x, y, s) {
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(x + s / 2, y, x + s / 2, y + s);
  doc.line(x, y + s, x + s, y + s);
  doc.line(x - s * 0.1, y + s * 0.25, x + s * 1.1, y + s * 0.25);
  doc.line(x - s * 0.1, y + s * 0.4, x + s * 0.1, y + s * 0.4);
  doc.line(x + s * 0.9, y + s * 0.4, x + s * 1.1, y + s * 0.4);
}

function resolveProduto(ticket, pedido, produtoNome) {
  if (ticket.tipo === 'venda' && pedido && produtoNome) return produtoNome(pedido.produto_id) || '—';
  if (ticket.produto_id && produtoNome) return produtoNome(ticket.produto_id) || '—';
  return '—';
}

function resolveDestino(ticket, pedido, clienteNome) {
  if (ticket.destino) return ticket.destino;
  if (ticket.tipo === 'venda' && pedido && clienteNome) return clienteNome(pedido.cliente_id) || '—';
  return '—';
}

function buildObservacoes(ticket) {
  const lines = [];
  if (ticket.observacao) {
    ticket.observacao.split('\n').forEach((l) => l.trim() && lines.push(l.trim()));
  }
  lines.push('Dados registrados automaticamente pelo sistema SGENH.');
  lines.push('Conferido e validado pelo operador responsável.');
  return lines;
}

/**
 * Gera o PDF do ticket.
 * @param {object} ticket
 * @param {object} ctx - { pedido, produtoNome, clienteNome }
 * @param {object} opts - { print: true } abre o diálogo de impressão; senão baixa o arquivo.
 */
export async function gerarTicketPDF(ticket, ctx = {}, opts = {}) {
  const { pedido, produtoNome, clienteNome } = ctx;
  const logo = await loadLogoDataUrl();

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;

  // Moldura
  doc.setDrawColor(225, 230, 225);
  doc.setLineWidth(0.3);
  doc.rect(margin - 4, margin - 4, contentW + 8, pageH - (margin - 4) * 2);

  let y = margin;

  // Cabeçalho: logo + texto
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', margin, y, 18, 18);
    } catch {}
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('FAZENDA', margin + 22, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('NOVO HORIZONTE', margin + 22, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('Sistema de Gerenciamento de Estoque - SGENH', margin + 22, y + 16);

  y += 22;
  doc.setDrawColor(220, 224, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentW, y);
  y += 11;

  // Título + selo do tipo
  const tipo = TIPO_LABEL[ticket.tipo] || 'Avulsa';
  const title = 'TICKET DE PESAGEM';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  const tw = doc.getTextWidth(title);
  const cx = pageW / 2;
  const iconSize = 6;
  drawScaleIcon(doc, cx - tw / 2 - iconSize - 2, y - 4, iconSize);
  doc.text(title, cx, y, { align: 'center' });

  // selo
  const colors = TIPO_COLORS[ticket.tipo] || TIPO_COLORS.avulsa;
  const badgeW = Math.max(22, doc.getTextWidth(tipo) + 10);
  const badgeX = margin + contentW - badgeW;
  doc.setFillColor(...colors.bg);
  doc.roundedRect(badgeX, y - 5, badgeW, 8, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...colors.text);
  doc.text(tipo, badgeX + badgeW / 2, y, { align: 'center' });

  y += 9;
  doc.setDrawColor(220, 224, 220);
  doc.line(margin, y, margin + contentW, y);
  y += 8;

  // Painéis
  const panelH = 76;
  const gap = 6;
  const panelW = (contentW - gap) / 2;
  const leftX = margin;
  const rightX = margin + panelW + gap;

  doc.setFillColor(247, 250, 247);
  doc.setDrawColor(222, 226, 222);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftX, y, panelW, panelH, 3, 3, 'FD');
  doc.roundedRect(rightX, y, panelW, panelH, 3, 3, 'FD');

  // Painel esquerdo — Dados do Ticket
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text('DADOS DO TICKET', leftX + 4, y + 6);

  const dataRows = [
    ['Ticket N°', ticket.numero || '—'],
    ['Data', fmtDate(ticket.data_fechamento || ticket.data_abertura)],
    ['Hora', fmtTime(ticket.data_fechamento || ticket.data_abertura)],
    ['Tipo', tipo],
    ['Placa do Veículo', ticket.placa || '—'],
    ['Motorista', ticket.motorista || '—'],
    ['Produto', resolveProduto(ticket, pedido, produtoNome)],
    ['Origem', ticket.origem || '—'],
    ['Destino', resolveDestino(ticket, pedido, clienteNome)],
  ];
  if (ticket.tipo === 'venda' && pedido) {
    dataRows.push(['Pedido', pedido.numero || '—']);
  }

  let ry = y + 12;
  doc.setFontSize(8.5);
  const labelX = leftX + 4;
  const valueX = leftX + 4 + 33;
  dataRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(label + ':', labelX, ry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(String(val).slice(0, 30), valueX, ry);
    ry += 6.4;
    doc.setDrawColor(234, 238, 234);
    doc.line(labelX, ry - 3, leftX + panelW - 4, ry - 3);
  });

  // Painel direito — Pesos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text('PESOS', rightX + 4, y + 6);

  let pry = y + 16;
  doc.setFontSize(10);
  [
    ['Peso Bruto (kg)', fmtNum(ticket.peso_bruto)],
    ['Tara (kg)', fmtNum(ticket.peso_tara)],
  ].forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(label, rightX + 4, pry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(val, rightX + panelW - 4, pry, { align: 'right' });
    pry += 8;
  });

  doc.setDrawColor(210, 214, 210);
  doc.line(rightX + 4, pry, rightX + panelW - 4, pry);
  pry += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9);
  doc.text('Peso Líquido (kg)', rightX + 4, pry);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.setFontSize(22);
  doc.text(fmtNum(ticket.peso_liquido), rightX + panelW - 4, pry + 2, { align: 'right' });

  y += panelH + 10;

  // Observações
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('Observações', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  buildObservacoes(ticket).forEach((line) => {
    doc.text('• ' + line, margin + 1, y);
    y += 5.5;
  });

  // Assinaturas
  const sigY = pageH - 28;
  const sigW = (contentW - 20) / 2;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(margin, sigY, margin + sigW, sigY);
  doc.line(margin + sigW + 20, sigY, margin + contentW, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('Assinatura do Operador', margin + sigW / 2, sigY + 5, { align: 'center' });
  doc.text('Assinatura do Motorista', margin + sigW + 20 + sigW / 2, sigY + 5, { align: 'center' });

  if (opts.print) {
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Ticket-${(ticket.numero || 'pesagem').replace(/[^a-zA-Z0-9-]/g, '')}.pdf`);
  }
}