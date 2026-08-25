// Geração do Ticket de Pesagem em PDF — layout "Painéis Agrupados".
import { jsPDF } from 'jspdf';

const LOGO_URL =
  'https://media.base44.com/images/public/6a84b445f638bd5605381437/708755ddd_ImagemdoWhatsAppde2025-01-17s153747_b380a23b.jpg';

const TIPO_LABEL = { venda: 'Venda', lavoura: 'Lavoura', avulsa: 'Avulsa' };

const TIPO_COLORS = {
  venda: { bg: [200, 230, 201], text: [26, 93, 26] },
  lavoura: { bg: [255, 243, 196], text: [141, 110, 0] },
  avulsa: { bg: [224, 224, 224], text: [55, 55, 55] },
};

const GREEN = [43, 103, 59];
const INK = [17, 24, 23];          // valores preto
const LABEL = [107, 114, 128];     // rótulos cinza-escuro (legível)
const LINE = [226, 232, 230];

function loadLogoDataUrl() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = LOGO_URL;
  });
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

function buildObservacoes(ticket) {
  const lines = [];
  if (ticket.observacao) {
    ticket.observacao.split('\n').forEach((l) => l.trim() && lines.push(l.trim()));
  }
  lines.push('Dados registrados automaticamente pelo sistema SGENH.');
  lines.push('Conferido e validado pelo operador responsável.');
  return lines;
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
  const logo = await loadLogoDataUrl();

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

  // Cabeçalho: logo + textos
  const logoBox = 20;
  if (logo) {
    // fundo circular claro para a logo
    doc.setFillColor(243, 248, 244);
    doc.circle(margin + logoBox / 2, y + logoBox / 2, logoBox / 2 + 1.5, 'F');
    // preserva proporção
    const ratio = logo.h ? logo.w / logo.h : 1;
    let dw = logoBox, dh = logoBox;
    if (ratio > 1) { dh = logoBox / ratio; } else { dw = logoBox * ratio; }
    const dx = margin + (logoBox - dw) / 2;
    const dy = y + (logoBox - dh) / 2;
    try { doc.addImage(logo.dataUrl, 'JPEG', dx, dy, dw, dh); } catch {}
  } else {
    doc.setFillColor(...GREEN);
    doc.circle(margin + logoBox / 2, y + logoBox / 2, logoBox / 2, 'F');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...LABEL);
  doc.text('FAZENDA', margin + logoBox + 5, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...INK);
  doc.text('NOVO HORIZONTE', margin + logoBox + 5, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...LABEL);
  doc.text('Sistema de Gerenciamento de Estoque - SGENH', margin + logoBox + 5, y + 18.5);

  y += logoBox + 6;
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
  const panelH = 82;
  const gap = 7;
  const panelW = (contentW - gap) / 2;
  const leftX = margin;
  const rightX = margin + panelW + gap;

  // cartões
  doc.setFillColor(250, 252, 251);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(leftX, y, panelW, panelH, 3, 3, 'FD');
  doc.roundedRect(rightX, y, panelW, panelH, 3, 3, 'FD');

  // barra de título dos cartões
  doc.setFillColor(...GREEN);
  doc.roundedRect(leftX, y, panelW, 7, 3, 3, 'F');
  doc.roundedRect(rightX, y, panelW, 7, 3, 3, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(leftX, y + 4, panelW, 3, 'F');
  doc.rect(rightX, y + 4, panelW, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DADOS DO TICKET', leftX + 5, y + 5);
  doc.text('PESOS', rightX + 5, y + 5);

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

  const valW = 34;
  let ry = y + 14;
  dataRows.forEach(([label, val]) => {
    drawRow(doc, leftX + 5, label, val, ry, panelW - 10, valW);
    ry += 7;
  });

  // Painel direito — Pesos
  let pry = y + 18;
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

  // Observações
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
  buildObservacoes(ticket).forEach((line) => {
    doc.text('•  ' + line, margin + 1, y);
    y += 5.8;
  });

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