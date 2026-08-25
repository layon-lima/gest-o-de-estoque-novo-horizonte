// Geração do Ticket de Pesagem em PDF — layout fiel à planilha ticket001.xlsx.
// Um ticket por folha A4 (210 x 297 mm). Logo extraído do próprio arquivo xlsx.
import { jsPDF } from 'jspdf';

const TIPO_LABEL = { venda: 'VENDA', lavoura: 'LAVOURA', avulsa: 'AVULSA' };

const XLSX_URL =
  'https://media.base44.com/files/public/6a84b445f638bd5605381437/faca5668c_ticket001.xlsx';

// --- Geometria da planilha (11 colunas A–K, largura ~8,8867 chars cada) ---
const ML = 7;                                  // margem esquerda (mm)
const COLW = 196 / 11;                         // largura de cada coluna
const X = Array.from({ length: 12 }, (_, i) => ML + COLW * i);
// X[0]=A ... X[11]=fim   (A=7,B=24.82,C=42.64,D=60.45,E=78.27,F=96.09,
//                         G=113.91,H=131.73,I=149.55,J=167.36,K=185.18,fim=203)

// Bandas verticais (mm) — reproduzem as linhas mescladas do modelo
const Y = {
  headerTop: 8, headerBot: 60,        // linhas 1-5 (logo + título)
  ntTop: 60, ntBot: 78,              // linha 6-7 (N° + tipo)
  motTop: 82, motBot: 100,           // motorista
  plaTop: 104, plaBot: 122,          // placa
  proTop: 126, proBot: 144,          // produto
  datTop: 148, datBot: 166,          // data - hora
  pLabTop: 172, pLabBot: 184,       // rótulos dos pesos
  pValTop: 184, pValBot: 216,        // valores dos pesos
  obsTop: 222, obsBot: 244,          // observações
  sigY: 274,                         // linha de assinatura
};

const INK = [0, 0, 0];
const BORDER = [120, 120, 120];

// --- Helpers de formatação ---
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtNum(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// --- Extração do logo (image1.jpg) embutido no xlsx, feita no navegador ---
let logoCache = null;
async function loadSheetLogo() {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(XLSX_URL);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const dv = new DataView(ab);
    const u8 = new Uint8Array(ab);
    // localiza o End Of Central Directory
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
        eocd = i; break;
      }
    }
    if (eocd < 0) return null;
    const cdCount = dv.getUint16(eocd + 10, true);
    let cdOff = dv.getUint32(eocd + 16, true);
    let entry = null;
    for (let i = 0; i < cdCount; i++) {
      if (dv.getUint32(cdOff, true) !== 0x02014b50) break;
      const method = dv.getUint16(cdOff + 10, true);
      const compSize = dv.getUint32(cdOff + 20, true);
      const fnLen = dv.getUint16(cdOff + 28, true);
      const extraLen = dv.getUint16(cdOff + 30, true);
      const cLen = dv.getUint16(cdOff + 32, true);
      const lho = dv.getUint32(cdOff + 42, true);
      let fn = '';
      for (let j = 0; j < fnLen; j++) fn += String.fromCharCode(u8[cdOff + 46 + j]);
      cdOff += 46 + fnLen + extraLen + cLen;
      if (/media\/image1\./i.test(fn)) { entry = { method, compSize, lho }; break; }
    }
    if (!entry) return null;
    const lfn = dv.getUint16(entry.lho + 26, true);
    const lex = dv.getUint16(entry.lho + 28, true);
    const ds = entry.lho + 30 + lfn + lex;
    let blob;
    if (entry.method === 0) {
      blob = new Blob([u8.slice(ds, ds + entry.compSize)], { type: 'image/jpeg' });
    } else if (typeof DecompressionStream !== 'undefined') {
      const comp = u8.slice(ds, ds + entry.compSize);
      const stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      blob = await new Response(stream).blob();
    } else {
      return null;
    }
    const url = URL.createObjectURL(blob);
    logoCache = await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = url;
    });
    return logoCache;
  } catch (e) {
    return null;
  }
}

// --- Desenho vetorial do logo (fallback) ---
const SUN = [255, 179, 0];
const HILL_DARK = [46, 125, 50];
const HILL_LIGHT = [102, 187, 106];
const HAND = [93, 64, 55];
function drawLogo(doc, cx, cy, r) {
  doc.setFillColor(...SUN); doc.circle(cx, cy, r, 'F');
  doc.setFillColor(...HILL_DARK);
  doc.circle(cx - r * 0.18, cy + r * 0.95, r * 0.78, 'F');
  doc.circle(cx + r * 0.45, cy + r * 0.95, r * 0.7, 'F');
  doc.setFillColor(...HILL_LIGHT);
  doc.circle(cx + r * 0.08, cy + r * 0.85, r * 0.62, 'F');
  doc.setFillColor(255, 255, 255); doc.circle(cx, cy + r * 1.22, r * 0.8, 'F');
  doc.setFillColor(...HAND); doc.circle(cx, cy + r * 1.22, r * 0.74, 'F');
}

// --- Primitivas de desenho ---
function rect(doc, x1, y1, x2, y2) {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x1, y1, x2 - x1, y2 - y1, 'S');
}
function vline(doc, x, y1, y2) {
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
  doc.line(x, y1, x, y2);
}
function hline(doc, x1, x2, y) {
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
}
// texto centralizado verticalmente numa caixa
function cellText(doc, x1, y1, x2, y2, text, { size = 11, bold = false, align = 'left' } = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  const cy = (y1 + y2) / 2 + size * 0.12;
  const ax = align === 'center' ? (x1 + x2) / 2 : align === 'right' ? x2 - 1.5 : x1 + 1.5;
  doc.text(String(text), ax, cy, { align });
}

function resolveProduto(ticket, pedido, produtoNome) {
  if (ticket.tipo === 'venda' && pedido && produtoNome) return produtoNome(pedido.produto_id) || '—';
  if (ticket.produto_id && produtoNome) return produtoNome(ticket.produto_id) || '—';
  return '—';
}

function drawTicket(doc, ticket, ctx, logoImg) {
  const { pedido, produtoNome } = ctx;
  const tipo = TIPO_LABEL[ticket.tipo] || 'AVULSA';
  const dataTxt = fmtDateTime(ticket.data_fechamento || ticket.data_abertura);

  // fundo branco
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // ===== Cabeçalho (linhas 1-5) =====
  rect(doc, X[0], Y.headerTop, X[3], Y.headerBot);   // logo  A1:C5
  rect(doc, X[3], Y.headerTop, X[11], Y.headerBot);  // título D1:K5
  // logo: ajusta (contain) na caixa A1:C5
  const lbX = X[0], lbY = Y.headerTop, lbW = X[3] - X[0], lbH = Y.headerBot - Y.headerTop;
  if (logoImg) {
    const iw = logoImg.naturalWidth || logoImg.width;
    const ih = logoImg.naturalHeight || logoImg.height;
    if (iw && ih) {
      const pad = 2;
      const aw = lbW - pad * 2, ah = lbH - pad * 2;
      const s = Math.min(aw / iw, ah / ih);
      const w = iw * s, h = ih * s;
      doc.addImage(logoImg, 'JPEG', lbX + (lbW - w) / 2, lbY + (lbH - h) / 2, w, h);
    }
  } else {
    drawLogo(doc, lbX + lbW / 2, lbY + lbH / 2, Math.min(lbW, lbH) / 2 - 3);
  }
  // título
  cellText(doc, X[3], Y.headerTop, X[11], Y.headerBot, 'TICKET DE PESAGEM', { size: 24, bold: true, align: 'center' });

  // ===== Linha N° + tipo (6-7) =====
  rect(doc, X[0], Y.ntTop, X[11], Y.ntBot);
  vline(doc, X[1], Y.ntTop, Y.ntBot);  // A|B
  vline(doc, X[3], Y.ntTop, Y.ntBot);  // C|D
  cellText(doc, X[0], Y.ntTop, X[1], Y.ntBot, 'N°', { size: 11, bold: true });
  cellText(doc, X[1], Y.ntTop, X[3], Y.ntBot, ticket.numero || '—', { size: 12, bold: true });
  cellText(doc, X[3], Y.ntTop, X[11], Y.ntBot, tipo, { size: 12, bold: true, align: 'center' });

  // ===== Motorista (10-11) =====
  rect(doc, X[0], Y.motTop, X[11], Y.motBot);
  vline(doc, X[2], Y.motTop, Y.motBot);
  cellText(doc, X[0], Y.motTop, X[2], Y.motBot, 'MOTORISTA', { size: 11, bold: true });
  cellText(doc, X[2], Y.motTop, X[11], Y.motBot, ticket.motorista || '—', { size: 12, bold: true });

  // ===== Placa (13-14) =====
  rect(doc, X[0], Y.plaTop, X[11], Y.plaBot);
  vline(doc, X[2], Y.plaTop, Y.plaBot);
  cellText(doc, X[0], Y.plaTop, X[2], Y.plaBot, 'PLACA', { size: 11, bold: true });
  cellText(doc, X[2], Y.plaTop, X[11], Y.plaBot, (ticket.placa || '—').toUpperCase(), { size: 12, bold: true });

  // ===== Produto (16-17) =====
  rect(doc, X[0], Y.proTop, X[11], Y.proBot);
  vline(doc, X[2], Y.proTop, Y.proBot);
  cellText(doc, X[0], Y.proTop, X[2], Y.proBot, 'PRODUTO', { size: 11, bold: true });
  const prodNome = resolveProduto(ticket, pedido, produtoNome);
  // quebra se necessário
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...INK);
  const prodLines = doc.splitTextToSize(prodNome, X[11] - X[2] - 3);
  doc.text(prodLines[0] || '—', X[2] + 1.5, (Y.proTop + Y.proBot) / 2 + 12 * 0.12);

  // ===== Data - Hora (19-20) =====
  rect(doc, X[0], Y.datTop, X[11], Y.datBot);
  vline(doc, X[2], Y.datTop, Y.datBot);
  cellText(doc, X[0], Y.datTop, X[2], Y.datBot, 'DATA - HORA', { size: 11, bold: true });
  cellText(doc, X[2], Y.datTop, X[11], Y.datBot, dataTxt, { size: 12, bold: true });

  // ===== Pesos (22-24) — três caixas: TARA | BRUTO | LÍQUIDO =====
  const boxes = [
    { x1: X[1], x2: X[4], label: 'PESO TARA (kg)', val: ticket.peso_tara },     // B:D
    { x1: X[4], x2: X[7], label: 'PESO BRUTO (kg)', val: ticket.peso_bruto },    // E:G
    { x1: X[7], x2: X[10], label: 'PESO LÍQUIDO (kg)', val: ticket.peso_liquido }, // H:J
  ];
  boxes.forEach((b) => {
    rect(doc, b.x1, Y.pLabTop, b.x2, Y.pValBot);
    hline(doc, b.x1, b.x2, Y.pLabBot);
    cellText(doc, b.x1, Y.pLabTop, b.x2, Y.pLabBot, b.label, { size: 10, bold: true, align: 'center' });
    cellText(doc, b.x1, Y.pValTop, b.x2, Y.pValBot, fmtNum(b.val), { size: 20, bold: true, align: 'center' });
  });

  // ===== Observações (26-27) =====
  rect(doc, X[0], Y.obsTop, X[11], Y.obsBot);
  vline(doc, X[2], Y.obsTop, Y.obsBot);
  cellText(doc, X[0], Y.obsTop, X[2], Y.obsBot, 'Observações', { size: 11, bold: true });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INK);
  const obsLines = doc.splitTextToSize(ticket.observacao || '—', X[11] - X[2] - 3);
  doc.text(obsLines.slice(0, 2), X[2] + 1.5, Y.obsTop + 6);

  // ===== Assinaturas (34) =====
  const sigY = Y.sigY;
  doc.setDrawColor(...INK); doc.setLineWidth(0.3);
  doc.line(X[1], sigY, X[4], sigY);             // Motorista  B:E
  doc.line(X[6], sigY, X[9], sigY);            // Balanceiro G:J
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text('Assinatura do Motorista', (X[1] + X[4]) / 2, sigY + 4, { align: 'center' });
  doc.text('Assinatura do Balanceiro', (X[6] + X[9]) / 2, sigY + 4, { align: 'center' });
}

/**
 * Gera o PDF do ticket (aberto ou fechado) — uma folha A4 por ticket.
 * @param {object} ticket
 * @param {object} ctx - { pedido, produtoNome, clienteNome }
 * @param {object} opts - { print: true } abre impressão; senão baixa o arquivo.
 */
export async function gerarTicketPDF(ticket, ctx = {}, opts = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logoImg = await loadSheetLogo();
  drawTicket(doc, ticket, ctx, logoImg);
  if (opts.print) {
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Ticket-${(ticket.numero || 'pesagem').replace(/[^a-zA-Z0-9-]/g, '')}.pdf`);
  }
}