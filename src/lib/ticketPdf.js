// Geração do Ticket de Pesagem em PDF — layout "Painéis Agrupados".
import { jsPDF } from 'jspdf';

const TIPO_LABEL = { venda: 'Venda', lavoura: 'Lavoura', avulsa: 'Avulsa' };

const TIPO_COLORS = {
  venda: { bg: [200, 230, 201], text: [26, 93, 26] },
  lavoura: { bg: [255, 243, 196], text: [141, 110, 0] },
  avulsa: { bg: [224, 224, 224], text: [55, 55, 55] },
};

const GREEN = [43, 103, 59];
const GREEN_DK = [27, 70, 42];
const GREEN_LT = [222, 240, 228];
const SUN = [214, 158, 46];
const INK = [17, 24, 23];          // valores preto
const LABEL = [107, 114, 128];     // rótulos cinza-escuro (legível)
const LINE = [226, 232, 230];

// Logo vetorial padrão da fazenda — emblema circular com sol/folha.
function drawLogo(doc, cx, cy, r) {
  // anel externo
  doc.setFillColor(...GREEN_DK);
  doc.circle(cx, cy, r, 'F');
  // campo interno claro
  doc.setFillColor(...GREEN_LT);
  doc.circle(cx, cy, r * 0.82, 'F');
  // sol (semicírculo) ao topo
  doc.setFillColor(...SUN);
  doc.circle(cx, cy + r * 0.18, r * 0.34, 'F');
  // campos (curvas inferiores) — duas meias-luas verdes
  doc.setFillColor(...GREEN);
  doc.circle(cx - r * 0.32, cy - r * 0.05, r * 0.42, 'F');
  doc.circle(cx + r * 0.32, cy - r * 0.05, r * 0.42, 'F');
  // recorta o topo com o campo claro para formar horizonte
  doc.setFillColor(...GREEN_LT);
  doc.rect(cx - r, cy - r, r * 2, r * 0.5, 'F');
  // repinta sol acima do horizonte
  doc.setFillColor(...SUN);
  doc.circle(cx, cy + r * 0.18, r * 0.3, 'F');
  // monograma NH no anel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(r * 0.5);
  doc.setTextColor(...GREEN_DK);
  doc.text('NH', cx, cy - r * 0.92, { align: 'center' });
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
  doc.setLineWidth(0.5);
  doc.line(x + s / 2, y, x + s / 2, y + s);
  doc.line(x, y + s, x + s, y + s);
  doc.line(x - s * 0.15, y + s * 0.3, x + s * 1.15, y + s * 0.3);
  doc.line(x - s * 0.15, y + s * 0.45, x + s * 0.05, y + s * 0.45);
  doc.line(x + s * 0.95, y + s * 0.45, x + s * 1.15, y + s * 0.45);
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

function drawRow(doc, x, label, value, y, maxW, valW) {
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...LABEL);
  doc.setFontSize(8.5);
  doc.text(label + ':', x, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.setFontSize(9.5);
  doc.text(String(value).slice(0, 32), x + valW, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(x, y + 2.2, x + maxW, y + 2.2);
}

/**
 * Gera o PDF do ticket (aberto ou fechado).
 * @param {object} ticket
 * @param {object} ctx - { pedido, produtoNome, clienteNome }
 * @param {object} opts - { print: true } abre impressão; senão baixa o arquivo.
 */
export async function gerarTicketPDF(ticket, ctx = {}, opts = {}) {
  const { pedido, produtoNome, clienteNome } = ctx;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 16;
  const contentW = pageW - margin * 2;

  // Fundo do container
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Moldura externa
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin - 6, margin - 6, contentW + 12, pageH - (margin - 6) * 2, 4, 4, 'D');
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin - 4, margin - 4, contentW + 8, pageH - (margin - 4) * 2, 3, 3, 'D');

  let y = margin;

  // Cabeçalho: logo vetorial + textos
  const logoR = 10;
  const logoCx = margin + logoR;
  const logoCy = y + logoR;
  drawLogo(doc, logoCx, logoCy, logoR);

  const textX = margin + logoR * 2 + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...LABEL);
  doc.text('FAZENDA', textX, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text('NOVO HORIZONTE', textX, y + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...LABEL);
  doc.text('Sistema de Gerenciamento de Estoque - SGENH', textX, y + 19);

  y += logoR * 2 + 6;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + contentW, y);
  y += 12;

  // Título + selo do tipo
  const tipo = TIPO_LABEL[ticket.tipo] || 'Avulsa';
  const title = 'TICKET DE PESAGEM';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  const tw = doc.getTextWidth(title);
  const cx = pageW / 2;
  const iconSize = 6;
  drawScaleIcon(doc, cx - tw / 2 - iconSize - 3, y - 4.5, iconSize);
  doc.text(title, cx, y, { align: 'center' });

  // selo
  const colors = TIPO_COLORS[ticket.tipo] || TIPO_COLORS.avulsa;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const badgeW = doc.getTextWidth(tipo) + 12;
  const badgeH = 8.5;
  const badgeX = margin + contentW - badgeW;
  doc.setFillColor(...colors.bg);
  doc.roundedRect(badgeX, y - 6, badgeW, badgeH, badgeH / 2, badgeH / 2, 'F');
  doc.setTextColor(...colors.text);
  doc.text(tipo, badgeX + badgeW / 2, y - 0.2, { align: 'center' });

  // status (aberto/fechado) à esquerda do selo
  const statusLabel = ticket.status === 'aberto' ? 'EM ABERTO' : 'FECHADO';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...LABEL);
  doc.text(statusLabel, margin, y);

  y += 8;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentW, y);
  y += 9;

  // Painéis
  const gap = 7;
  const panelW = (contentW - gap) / 2;
  const leftX = margin;
  const rightX = margin + panelW + gap;

  // Linhas do painel esquerdo
  const dataRows = [
    ['Ticket Nº', ticket.numero || '—'],
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

  const rowH = 7;
  const panelHeaderH = 8;
  const panelH = panelHeaderH + dataRows.length * rowH + 5;

  // cartões
  doc.setFillColor(250, 252, 251);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(leftX, y, panelW, panelH, 3, 3, 'FD');
  doc.roundedRect(rightX, y, panelW, panelH, 3, 3, 'FD');

  // barra de título dos cartões (sólida, texto centralizado)
  doc.setFillColor(...GREEN);
  doc.roundedRect(leftX, y, panelW, panelHeaderH, 3, 3, 'F');
  doc.roundedRect(rightX, y, panelW, panelHeaderH, 3, 3, 'F');
  doc.rect(leftX, y + panelHeaderH - 2.5, panelW, 2.5, 'F');
  doc.rect(rightX, y + panelHeaderH - 2.5, panelW, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DADOS DO TICKET', leftX + panelW / 2, y + panelHeaderH - 2.6, { align: 'center' });
  doc.text('PESOS', rightX + panelW / 2, y + panelHeaderH - 2.6, { align: 'center' });

  const valW = 34;
  let ry = y + panelHeaderH + 6;
  dataRows.forEach(([label, val]) => {
    drawRow(doc, leftX + 5, label, val, ry, panelW - 10, valW);
    ry += rowH;
  });

  // Painel direito — Pesos
  let pry = y + panelHeaderH + 12;
  doc.setFontSize(10.5);
  [
    ['Peso Bruto (kg)', fmtNum(ticket.peso_bruto)],
    ['Tara (kg)', fmtNum(ticket.peso_tara)],
  ].forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...LABEL);
    doc.text(label, rightX + 5, pry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.setFontSize(13);
    doc.text(val, rightX + panelW - 5, pry, { align: 'right' });
    pry += 10;
  });

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(rightX + 5, pry, rightX + panelW - 5, pry);
  pry += 11;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...LABEL);
  doc.setFontSize(9.5);
  doc.text('Peso Líquido (kg)', rightX + 5, pry);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.setFontSize(26);
  doc.text(fmtNum(ticket.peso_liquido), rightX + panelW - 5, pry + 2, { align: 'right' });

  y += panelH + 11;

  // Observações — somente quando o usuário digitou algo
  const obsLinhas = ticket.observacao
    ? ticket.observacao.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  if (obsLinhas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text('Observações', margin, y);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, margin + 40, y + 2);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...LABEL);
    obsLinhas.forEach((line) => {
      doc.text('•  ' + line, margin + 1, y);
      y += 5.8;
    });
  }

  // Assinaturas
  const sigY = pageH - 32;
  const sigW = (contentW - 24) / 2;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(margin, sigY, margin + sigW, sigY);
  doc.line(margin + sigW + 24, sigY, margin + contentW, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...LABEL);
  doc.text('Assinatura do Operador', margin + sigW / 2, sigY + 5, { align: 'center' });
  doc.text('Assinatura do Motorista', margin + sigW + 24 + sigW / 2, sigY + 5, { align: 'center' });

  // Rodapé
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text('Documento gerado pelo SGENH - Sistema de Gerenciamento de Estoque Novo Horizonte', pageW / 2, pageH - margin + 2, { align: 'center' });

  if (opts.print) {
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Ticket-${(ticket.numero || 'pesagem').replace(/[^a-zA-Z0-9-]/g, '')}.pdf`);
  }
}