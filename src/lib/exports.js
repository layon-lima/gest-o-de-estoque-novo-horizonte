import jsPDF from 'jspdf';

// Ajusta o texto para caber dentro de uma largura máxima, adicionando "…" se necessário.
function fitText(doc, value, maxWidth) {
  const text = String(value ?? '');
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && doc.getTextWidth(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t.length > 0 ? t + '…' : '';
}

export function exportPDF(titulo, colunas, linhas) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;

  // Cabeçalho do documento
  doc.setFontSize(16);
  doc.setTextColor(34, 139, 87);
  doc.text(titulo, margin, 16);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 22);

  // Calcula larguras proporcionais por coluna com base no conteúdo real.
  doc.setFontSize(8);
  const padding = 3;
  const colWidths = colunas.map((col, ci) => {
    let maxW = doc.getTextWidth(String(col));
    linhas.forEach((linha) => {
      const w = doc.getTextWidth(String(linha[ci] ?? ''));
      if (w > maxW) maxW = w;
    });
    return maxW + padding * 2;
  });
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const scale = totalW > usableWidth ? usableWidth / totalW : 1;
  const finalWidths = colWidths.map((w) => w * scale);

  const headerHeight = 8;
  const rowHeight = 7;
  let y = 30;
  const startX = margin;

  function drawHeader() {
    doc.setFillColor(34, 139, 87);
    doc.rect(startX, y - 6, finalWidths.reduce((a, b) => a + b, 0), headerHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    let x = startX;
    colunas.forEach((col, i) => {
      const txt = fitText(doc, col, finalWidths[i] - padding * 2);
      doc.text(txt, x + padding, y);
      x += finalWidths[i];
    });
    y += headerHeight;
  }

  function drawGrid() {
    // Linhas verticais
    doc.setDrawColor(210, 215, 210);
    doc.setLineWidth(0.2);
    let x = startX;
    colunas.forEach((_, i) => {
      doc.line(x, y - 6, x, y + rowHeight - 2);
      x += finalWidths[i];
    });
    doc.line(x, y - 6, x, y + rowHeight - 2);
    // Linha inferior
    doc.line(startX, y + rowHeight - 2, startX + finalWidths.reduce((a, b) => a + b, 0), y + rowHeight - 2);
  }

  drawHeader();

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  let rowIndex = 0;
  linhas.forEach((linha) => {
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = 20;
      drawHeader();
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
    }
    // Zebra
    if (rowIndex % 2 === 0) {
      doc.setFillColor(245, 250, 247);
      doc.rect(startX, y - 6, finalWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
    }
    let x = startX;
    linha.forEach((cell, ci) => {
      const txt = fitText(doc, cell, finalWidths[ci] - padding * 2);
      doc.text(txt, x + padding, y);
      x += finalWidths[ci];
    });
    drawGrid();
    y += rowHeight;
    rowIndex++;
  });

  doc.save(`${titulo}.pdf`);
}

export function exportCSV(titulo, colunas, linhas) {
  // Delimitador ";" para compatibilidade com Excel em português (pt-BR).
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