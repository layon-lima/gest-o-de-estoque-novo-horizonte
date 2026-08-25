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
const SUN = [255, 179, 0];          // amarelo sol (#FFB300)
const HILL_DARK = [46, 125, 50];    // verde escuro das colinas (#2E7D32)
const HILL_LIGHT = [102, 187, 106]; // verde claro (#66BB6A)
const HAND = [93, 64, 55];          // marrom da mão (#5D4037)
const INK = [17, 24, 23];
const LABEL = [107, 114, 128];
const LINE = [226, 232, 230];

const LOGO_SVG_URL =
  'https://media.base44.com/images/public/6a84b445f638bd5605381437/950b68ffe_Designsemnome.svg';

// Carrega o SVG da fazenda e rasteriza em PNG de alta resolução, preservando proporção.
async function loadLogo() {
  try {
    const res = await fetch(LOGO_SVG_URL);
    if (!res.ok) return null;
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const maxSide = 512;
    const natW = img.naturalWidth || 256;
    const natH = img.naturalHeight || 256;
    const fit = Math.min(maxSide / natW, maxSide / natH, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(natW * fit);
    canvas.height = Math.round(natH * fit);
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      w: canvas.width,
      h: canvas.height,
    };
  } catch (e) {
    return null;
  }
}

// Logo vetorial da fazenda — sol amarelo, colinas verdes, plantas e mão acolhedora.
function drawLogo(doc, cx, cy, r) {
  // 1) Sol — disco amarelo (fundo do emblema)
  doc.setFillColor(...SUN);
  doc.circle(cx, cy, r, 'F');

  // 2) Colinas — calotas verdes (círculos posicionados abaixo, só a parte de cima aparece)
  // colina escura de trás
  doc.setFillColor(...HILL_DARK);
  doc.circle(cx - r * 0.18, cy + r * 0.95, r * 0.78, 'F');
  doc.circle(cx + r * 0.45, cy + r * 0.95, r * 0.7, 'F');
  // colina clara da frente
  doc.setFillColor(...HILL_LIGHT);
  doc.circle(cx + r * 0.08, cy + r * 0.85, r * 0.62, 'F');

  // 3) Plantas — três tufos verde-escuro saindo das colinas
  const drawTuft = (tx) => {
    const topY = cy + r * 0.18;
    const baseY = cy + r * 0.55;
    doc.setDrawColor(...HILL_DARK);
    doc.setLineWidth(r * 0.04);
    doc.line(tx, baseY, tx, topY);
    // folhas (pequenos losangos)
    doc.setFillColor(...HILL_LIGHT);
    for (let i = 0; i < 3; i++) {
      const ly = topY + i * r * 0.12;
      const lw = r * 0.1;
      const lh = r * 0.05;
      doc.ellipse(tx - lw * 0.7, ly, lw / 2, lh / 2, 'F');
      doc.ellipse(tx + lw * 0.7, ly, lw / 2, lh / 2, 'F');
    }
    // topo
    doc.setFillColor(...HILL_DARK);
    doc.circle(tx, topY - r * 0.02, r * 0.05, 'F');
  };
  drawTuft(cx - r * 0.28);
  drawTuft(cx);
  drawTuft(cx + r * 0.26);

  // 4) Mão acolhedora — calota marrom na base com contorno branco
  // contorno branco (anel)
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy + r * 1.22, r * 0.8, 'F');
  // mão marrom
  doc.setFillColor(...HAND);
  doc.circle(cx, cy + r * 1.22, r * 0.74, 'F');
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

  // Cabeçalho: logo SVG da fazenda + textos (centralizados)
  const logoR = 60;
  const logoBox = logoR * 2;
  const logo = await loadLogo();
  if (logo) {
    const ratio = logo.w / logo.h || 1;
    let dw = logoBox, dh = logoBox;
    if (ratio > 1) dh = logoBox / ratio; else dw = logoBox * ratio;
    const dx = (pageW - dw) / 2;
    const dy = y;
    try { doc.addImage(logo.dataUrl, 'PNG', dx, dy, dw, dh); } catch {}
    y += dh + 4;
  } else {
    drawLogo(doc, pageW / 2, y + logoR, logoR);
    y += logoBox + 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...LABEL);
  doc.text('FAZENDA', pageW / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  doc.text('NOVO HORIZONTE', pageW / 2, y + 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...LABEL);
  doc.text('Sistema de Gerenciamento de Estoque - SGENH', pageW / 2, y + 25, { align: 'center' });

  y += 30 + 8;
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