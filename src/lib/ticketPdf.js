// Geração do Ticket de Pesagem em PDF — layout leve e simples, um ticket por folha A4.
// jsPDF é carregado sob demanda (import dinâmico) só ao gerar o documento.
const TIPO_LABEL = { venda: 'VENDA', lavoura: 'LAVOURA', avulsa: 'AVULSA' };

const XLSX_URL =
  'https://media.base44.com/files/public/6a84b445f638bd5605381437/faca5668c_ticket001.xlsx';

const INK = [0, 0, 0];
const MUTED = [130, 130, 130];
const LINE = [210, 210, 210];

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

// --- Logo vetorial (fallback) ---
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

function resolveProduto(ticket, pedido, produtoNome) {
  if (ticket.tipo === 'venda' && pedido && produtoNome) return produtoNome(pedido.produto_id) || '—';
  if (ticket.produto_id && produtoNome) return produtoNome(ticket.produto_id) || '—';
  return '—';
}

// --- Primitivas leves ---
function hline(doc, x1, x2, y, color = LINE, w = 0.2) {
  doc.setDrawColor(...color); doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
}
function text(doc, x, y, str, { size = 11, bold = false, color = INK, align = 'left' } = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(String(str), x, y, { align });
}

function drawTicket(doc, ticket, ctx, logoImg) {
  const { pedido, produtoNome } = ctx;
  const tipo = TIPO_LABEL[ticket.tipo] || 'AVULSA';
  const dataTxt = fmtDateTime(ticket.data_fechamento || ticket.data_abertura);

  const ML = 16, MR = 16, LW = 210 - ML - MR; // margens e largura útil

  // Fundo branco
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // ===== Cabeçalho: logo + título =====
  const logoX = ML, logoY = 14, logoSize = 26;
  if (logoImg) {
    const iw = logoImg.naturalWidth || logoImg.width;
    const ih = logoImg.naturalHeight || logoImg.height;
    if (iw && ih) {
      const s = Math.min(logoSize / iw, logoSize / ih);
      const w = iw * s, h = ih * s;
      doc.addImage(logoImg, 'JPEG', logoX + (logoSize - w) / 2, logoY + (logoSize - h) / 2, w, h);
    }
  } else {
    drawLogo(doc, logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 - 2);
  }

  text(doc, ML + logoSize + 8, logoY + 10, 'NOVO HORIZONTE', { size: 18, bold: true });
  text(doc, ML + logoSize + 8, logoY + 18, 'TICKET DE PESAGEM', { size: 11, color: MUTED });

  // Rótulo do tipo à direita
  text(doc, 210 - MR, logoY + 10, tipo, { size: 14, bold: true, align: 'right' });

  // Linha de separação do cabeçalho
  hline(doc, ML, 210 - MR, logoY + logoSize + 4);

  // ===== Número =====
  let y = logoY + logoSize + 16;
  text(doc, ML, y, 'Nº', { size: 10, color: MUTED });
  text(doc, ML + 14, y, ticket.numero || '—', { size: 13, bold: true });
  hline(doc, ML, 210 - MR, y + 4);

  // ===== Linhas de informação (rótulo à esquerda, valor à direita) =====
  const labelX = ML;
  const valueX = ML + 42;
  function infoRow(label, value, opts = {}) {
    y += opts.gap || 14;
    text(doc, labelX, y, label, { size: 9, color: MUTED });
    text(doc, valueX, y, value, { size: 12, bold: true });
    hline(doc, ML, 210 - MR, y + 4);
  }

  infoRow('MOTORISTA', ticket.motorista || '—');
  infoRow('PLACA', (ticket.placa || '—').toUpperCase());
  infoRow('PRODUTO', resolveProduto(ticket, pedido, produtoNome));
  infoRow('DATA - HORA', dataTxt);

  // ===== Pesos: três caixas leves =====
  y += 18;
  const boxW = (LW - 8) / 3;
  const boxes = [
    { label: 'TARA (kg)', val: ticket.peso_tara },
    { label: 'BRUTO (kg)', val: ticket.peso_bruto },
    { label: 'LÍQUIDO (kg)', val: ticket.peso_liquido },
  ];
  boxes.forEach((b, i) => {
    const bx = ML + i * (boxW + 4);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
    doc.roundedRect(bx, y - 10, boxW, 34, 2, 2, 'S');
    text(doc, bx + boxW / 2, y - 3, b.label, { size: 9, color: MUTED, align: 'center' });
    text(doc, bx + boxW / 2, y + 16, fmtNum(b.val), { size: 22, bold: true, align: 'center' });
  });

  // ===== Observações (somente se houver) =====
  if (ticket.observacao && ticket.observacao.trim()) {
    y += 44;
    text(doc, ML, y, 'Observações', { size: 9, color: MUTED });
    y += 5;
    hline(doc, ML, 210 - MR, y, LINE, 0.2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INK);
    const obsLines = doc.splitTextToSize(ticket.observacao, LW);
    doc.text(obsLines.slice(0, 3), ML, y + 6);
  }

  // ===== Assinaturas =====
  const sigY = 254;
  doc.setDrawColor(...INK); doc.setLineWidth(0.3);
  doc.line(ML + 6, sigY, ML + 76, sigY);
  doc.line(210 - MR - 76, sigY, 210 - MR - 6, sigY);
  text(doc, ML + 41, sigY + 5, 'Assinatura do Motorista', { size: 9, align: 'center' });
  text(doc, 210 - MR - 41, sigY + 5, 'Assinatura do Balanceiro', { size: 9, align: 'center' });
}

/**
 * Gera o PDF do ticket (aberto ou fechado) — uma folha A4 por ticket.
 * @param {object} ticket
 * @param {object} ctx - { pedido, produtoNome, clienteNome }
 * @param {object} opts - { print: true } abre impressão; senão baixa o arquivo.
 */
export async function gerarTicketPDF(ticket, ctx = {}, opts = {}) {
  const { jsPDF } = await import('jspdf');
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