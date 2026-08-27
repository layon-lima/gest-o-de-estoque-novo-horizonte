import { jsPDF } from 'jspdf';

// Trunca texto longo com "…" quando não cabe mesmo no tamanho mínimo de fonte.
function fitText(doc, value, maxWidth) {
  const text = String(value ?? '');
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && doc.getTextWidth(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t.length > 0 ? t + '…' : '';
}

/**
 * Desenha uma célula reduzindo a fonte para caber — nunca trunca valores monetários/numéricos.
 * Textos muito longos (nomes) são truncados com "…" apenas no último recurso.
 */
function drawCell(doc, value, colStart, colWidth, yText, baseFontSize, align) {
  const text = String(value ?? '');
  if (!text) return;
  const padding = 1.5;
  const maxW = colWidth - padding * 2;

  doc.setFontSize(baseFontSize);
  let w = doc.getTextWidth(text);
  let fs = baseFontSize;
  while (w > maxW && fs > 5) {
    fs -= 0.5;
    doc.setFontSize(fs);
    w = doc.getTextWidth(text);
  }

  const txt = w > maxW ? fitText(doc, text, maxW) : text;
  if (align === 'right') {
    doc.text(txt, colStart + colWidth - padding, yText, { align: 'right' });
  } else {
    doc.text(txt, colStart + padding, yText);
  }
  doc.setFontSize(baseFontSize);
}

export async function exportPDF(titulo, colunas, linhas) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;

  // Cabeçalho do documento
  doc.setFontSize(14);
  doc.setTextColor(34, 139, 87);
  doc.text(titulo, margin, 13);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 18);

  const baseFontSize = 7;
  const headerHeight = 6;
  const rowHeight = 5; // Compacto verticalmente
  const minColW = 16;
  const maxColW = 65;

  // Calcula larguras com base no conteúdo, com piso e teto por coluna.
  doc.setFontSize(baseFontSize);
  const contentWidths = colunas.map((col, ci) => {
    let maxW = doc.getTextWidth(String(col));
    linhas.forEach((linha) => {
      const w = doc.getTextWidth(String(linha[ci] ?? ''));
      if (w > maxW) maxW = w;
    });
    return Math.min(Math.max(maxW + 3, minColW), maxColW);
  });

  // Distribui o espaço: se cabe com folga, expande proporcionalmente; se excede, escala.
  const totalContent = contentWidths.reduce((a, b) => a + b, 0);
  let finalWidths;
  if (totalContent <= usableWidth) {
    const extra = usableWidth - totalContent;
    finalWidths = contentWidths.map((w) => w + (extra * w) / totalContent);
  } else {
    const scale = usableWidth / totalContent;
    finalWidths = contentWidths.map((w) => w * scale);
  }

  // Colunas numéricas/monetárias → alinhamento à direita
  const rightAlignCols = new Set();
  colunas.forEach((col, ci) => {
    if (/peso|valor|r\$|kg|qtd|total|saldo/i.test(col)) rightAlignCols.add(ci);
  });

  const tableW = finalWidths.reduce((a, b) => a + b, 0);
  let y = 24;
  const startX = margin;

  function drawHeader() {
    doc.setFillColor(34, 139, 87);
    doc.rect(startX, y, tableW, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(baseFontSize);
    let x = startX;
    colunas.forEach((col, i) => {
      drawCell(doc, col, x, finalWidths[i], y + headerHeight - 2, baseFontSize, rightAlignCols.has(i) ? 'right' : 'left');
      x += finalWidths[i];
    });
    y += headerHeight;
  }

  drawHeader();

  doc.setFont(undefined, 'normal');
  doc.setTextColor(40, 40, 40);
  let rowIndex = 0;

  linhas.forEach((linha) => {
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin + 5;
      drawHeader();
      doc.setFont(undefined, 'normal');
      doc.setTextColor(40, 40, 40);
    }

    const tipoCell = String(linha[2] ?? '');
    const isSubtotal = tipoCell.includes('Subtotal');
    const isTotal = tipoCell.includes('TOTAL');
    const isEmpty = linha.every((c) => !String(c ?? '').trim());

    // 1) Fundo da linha
    if (isTotal) {
      doc.setFillColor(218, 240, 228);
      doc.rect(startX, y, tableW, rowHeight, 'F');
    } else if (isSubtotal) {
      doc.setFillColor(238, 246, 241);
      doc.rect(startX, y, tableW, rowHeight, 'F');
    } else if (!isEmpty && rowIndex % 2 === 0) {
      doc.setFillColor(248, 251, 249);
      doc.rect(startX, y, tableW, rowHeight, 'F');
    }

    // 2) Bordas (verticais + base) — desenhadas ANTES do texto para não cortar dados
    doc.setDrawColor(210, 216, 210);
    doc.setLineWidth(0.1);
    let x = startX;
    colunas.forEach((_, i) => {
      doc.line(x, y, x, y + rowHeight);
      x += finalWidths[i];
    });
    doc.line(x, y, x, y + rowHeight); // borda direita
    doc.line(startX, y + rowHeight, startX + tableW, y + rowHeight); // borda inferior

    // 3) Texto — desenhado POR CIMA das bordas
    if (isSubtotal || isTotal) {
      doc.setFont(undefined, 'bold');
    } else {
      doc.setFont(undefined, 'normal');
    }

    x = startX;
    linha.forEach((cell, ci) => {
      drawCell(doc, cell, x, finalWidths[ci], y + rowHeight - 1.5, baseFontSize, rightAlignCols.has(ci) ? 'right' : 'left');
      x += finalWidths[ci];
    });

    y += rowHeight;
    rowIndex++;
  });

  // Download via blob — mais confiável no mobile (doc.save() perde o gesto do usuário)
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportCSV(titulo, colunas, linhas) {
  const DELIM = ';';
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csv = [
    colunas.map(escape).join(DELIM),
    ...linhas.map((linha) => linha.map(escape).join(DELIM)),
  ].join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}