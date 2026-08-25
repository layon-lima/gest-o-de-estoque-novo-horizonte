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

const LOGO_PNG_URL =
  'https://media.base44.com/images/public/6a84b445f638bd5605381437/f74d0a800_MockupCircular512x5121.png';

// Carrega o logo circular PNG (1:1, sem margens) e retorna dataURL pronto para o PDF.
async function loadLogo() {
  try {
    const res = await fetch(LOGO_PNG_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const side = 512;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, side, side);
    ctx2.drawImage(img, 0, 0, side, side);
    // clipa ao círculo inscrito — remove cantos fora do emblema circular
    ctx2.globalCompositeOperation = 'destination-in';
    ctx2.beginPath();
    ctx2.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
    ctx2.fill();
    URL.revokeObjectURL(url);
    return { dataUrl: canvas.toDataURL('image/png'), w: side, h: side };
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

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function fmtLongDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getDate()} DE ${MESES[d.getMonth()].toUpperCase()} DE ${d.getFullYear()}`;
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
  doc.setFontSize(6);
  doc.text(label + ':', x, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.setFontSize(6.8);
  doc.text(String(value).slice(0, 30), x + valW, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.15);
  doc.line(x, y + 1.6, x + maxW, y + 1.6);
}

/**
 * Gera o PDF do ticket (aberto ou fechado).
 * @param {object} ticket
 * @param {object} ctx - { pedido, produtoNome, clienteNome }
 * @param {object} opts - { print: true } abre impressão; senão baixa o arquivo.
 */
function drawTicket(doc, y0, viaLabel, ticket, ctx, logo) {
  const { pedido, produtoNome, clienteNome } = ctx;
  const M = 8;
  const W = 210 - M * 2; // 194
  const H = 144;
  const tipo = TIPO_LABEL[ticket.tipo] || 'Avulsa';
  const tipoColors = TIPO_COLORS[ticket.tipo] || TIPO_COLORS.avulsa;
  const emissao = ticket.data_fechamento || ticket.data_abertura;

  // Borda externa do bloco
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y0, W, H, 2, 2, 'D');

  let y = y0;

  // ---------- Cabeçalho ----------
  const circleR = 11;
  const circleCx = M + circleR + 2;
  const circleCy = y + circleR + 2;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.7);
  doc.circle(circleCx, circleCy, circleR, 'S');
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.circle(circleCx, circleCy, circleR - 1, 'S');
  if (logo) {
    const fit = circleR * 2;
    try { doc.addImage(logo.dataUrl, 'PNG', circleCx - circleR, circleCy - circleR, fit, fit); } catch {}
  } else {
    drawLogo(doc, circleCx, circleCy, circleR - 1.5);
  }

  const textX = circleCx + circleR + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text('NOVO HORIZONTE', textX, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('Sistema de Gerenciamento de Estoque - SGENH', textX, y + 15);

  // Data/hora de emissão (canto superior direito)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...LABEL);
  doc.text('EMISSÃO', M + W, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(fmtDateTime(emissao), M + W, y + 11, { align: 'right' });

  y += 22;

  // ---------- Título ----------
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.45);
  doc.line(M, y, M + W, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text('TICKET DE PESAGEM', 210 / 2, y, { align: 'center' });
  // selo do tipo à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const badgeW = doc.getTextWidth(tipo) + 8;
  const badgeH = 6;
  const badgeX = M + W - badgeW;
  doc.setFillColor(...tipoColors.bg);
  doc.roundedRect(badgeX, y - 4.5, badgeW, badgeH, badgeH / 2, badgeH / 2, 'F');
  doc.setTextColor(...tipoColors.text);
  doc.text(tipo, badgeX + badgeW / 2, y - 0.3, { align: 'center' });
  // status à esquerda
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text(ticket.status === 'aberto' ? 'EM ABERTO' : 'FECHADO', M, y);
  y += 5;

  // ---------- Grade de dados (cabeçalho tabular) ----------
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.line(M, y, M + W, y);
  const gridTop = y;
  const gridH = 13;
  y += 4;
  const colW = W / 4;
  const cells = [
    ['TICKET Nº', ticket.numero || '—'],
    ['PLACA', ticket.placa || '—'],
    ['MOTORISTA', (ticket.motorista || '—').slice(0, 18)],
    ['TIPO', tipo],
  ];
  cells.forEach((c, i) => {
    const cx0 = M + colW * i + 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...LABEL);
    doc.text(c[0], cx0, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(c[1], cx0, y + 5);
  });
  // separadores verticais
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  for (let i = 1; i < 4; i++) {
    const vx = M + colW * i;
    doc.line(vx, gridTop, vx, gridTop + gridH);
  }
  y = gridTop + gridH;
  doc.line(M, y, M + W, y);
  y += 5;

  // ---------- Produto (+ Pedido p/ venda) ----------
  const produtoNomeTxt = resolveProduto(ticket, pedido, produtoNome);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('PRODUTO:', M, y);
  const prodLabelW = 18;
  let prodMaxW = W - prodLabelW - 10;
  if (ticket.tipo === 'venda' && pedido) {
    const pedidoTxt = 'PEDIDO: ' + (pedido.numero || '—');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const pedidoW = doc.getTextWidth(pedidoTxt);
    doc.setTextColor(...GREEN_DK);
    doc.text(pedidoTxt, M + W, y, { align: 'right' });
    prodMaxW = W - prodLabelW - pedidoW - 12;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const prodLines = doc.splitTextToSize(produtoNomeTxt, prodMaxW);
  doc.text(prodLines[0] || '—', M + prodLabelW, y);
  y += 8;

  // ---------- Origem / Destino ----------
  const halfW = (W - 6) / 2;
  const leftX = M;
  const rightX = M + halfW + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('ORIGEM:', leftX, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text((ticket.origem || '—').slice(0, 26), leftX + 16, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('DESTINO:', rightX, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(resolveDestino(ticket, pedido, clienteNome).slice(0, 26), rightX + 16, y);
  y += 8;

  // ---------- Datas ----------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('DATA ABERTURA:', leftX, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(fmtDateTime(ticket.data_abertura), leftX + 26, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('DATA FECHAMENTO:', rightX, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(fmtDateTime(ticket.data_fechamento), rightX + 30, y);
  y += 9;

  // ---------- Pesos ----------
  const weightTop = y;
  const weightH = 26;
  const boxW = 62;
  const boxX = M + W - boxW;
  // caixa destacada do peso líquido
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.7);
  doc.roundedRect(boxX, weightTop, boxW, weightH, 2, 2, 'D');
  doc.setFillColor(...GREEN_LT);
  doc.roundedRect(boxX, weightTop, boxW, 7, 2, 2, 'F');
  doc.rect(boxX, weightTop + 4, boxW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PESO LÍQUIDO (kg)', boxX + boxW / 2, weightTop + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GREEN_DK);
  doc.text(fmtNum(ticket.peso_liquido), boxX + boxW / 2, weightTop + weightH - 6, { align: 'center' });

  // pesos bruto / tara à esquerda da caixa
  const leftW = W - boxW - 6;
  const brutoY = weightTop + 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...LABEL);
  doc.text('PESO BRUTO (kg)', M, brutoY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(fmtNum(ticket.peso_bruto), M + leftW, brutoY, { align: 'right' });
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(M, weightTop + 13, M + leftW, weightTop + 13);
  const taraY = weightTop + 19;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...LABEL);
  doc.text('TARA (kg)', M, taraY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(fmtNum(ticket.peso_tara), M + leftW, taraY, { align: 'right' });

  y = weightTop + weightH + 5;

  // ---------- Observações ----------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('OBSERVAÇÕES:', M, y);
  const obsLinhas = ticket.observacao
    ? ticket.observacao.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  const obsText = obsLinhas.length > 0 ? obsLinhas.join(' / ') : '—';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const obsLines = doc.splitTextToSize(obsText, W - 30);
  doc.text(obsLines.slice(0, 1), M + 28, y);

  // ---------- Rodapé jurídico ----------
  const legalY = y0 + H - 32;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  const legal = 'Através deste ticket confirmamos a pesagem do veículo e a conferência do produto descrito acima, firmamos o presente para os devidos fins.';
  const legalLines = doc.splitTextToSize(legal, W - 10);
  doc.text(legalLines, 210 / 2, legalY, { align: 'center' });
  doc.text(`NOVO HORIZONTE, ${fmtLongDate(emissao)}.`, 210 / 2, legalY + 8, { align: 'center' });

  // Assinaturas
  const sigY = y0 + H - 14;
  const sigW = (W - 20) / 2;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.25);
  doc.line(M, sigY, M + sigW, sigY);
  doc.line(M + sigW + 20, sigY, M + W, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text('Assinatura do Operador', M + sigW / 2, sigY + 4, { align: 'center' });
  doc.text('Assinatura do Motorista', M + sigW + 20 + sigW / 2, sigY + 4, { align: 'center' });

  // ---------- Barra inferior ----------
  const barY = y0 + H - 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LABEL);
  doc.text(`${ticket.placa || ''} - ${tipo}`.trim(), M, barY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text('NOVO HORIZONTE', 210 / 2, barY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text(viaLabel, M + W, barY, { align: 'right' });
}

/**
 * Gera o PDF do ticket em A4, com a 1ª via na metade superior e a 2ª via na metade inferior.
 * @param {object} ticket
 * @param {object} ctx - { pedido, produtoNome, clienteNome }
 * @param {object} opts - { print: true } abre impressão; senão baixa o arquivo.
 */
export async function gerarTicketPDF(ticket, ctx = {}, opts = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  const logo = await loadLogo();
  drawTicket(doc, 4, '1ª Via', ticket, ctx, logo);
  drawTicket(doc, 150, '2ª Via', ticket, ctx, logo);

  if (opts.print) {
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Ticket-${(ticket.numero || 'pesagem').replace(/[^a-zA-Z0-9-]/g, '')}.pdf`);
  }
}