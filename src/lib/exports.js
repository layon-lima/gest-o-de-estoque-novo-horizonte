import jsPDF from 'jspdf';

export function exportPDF(titulo, colunas, linhas) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setTextColor(34, 139, 87);
  doc.text(titulo, 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 24);

  const colCount = colunas.length;
  const startX = 14;
  const usableWidth = pageWidth - 28;
  const colWidth = usableWidth / colCount;
  const rowHeight = 8;
  let y = 32;

  doc.setFillColor(34, 139, 87);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.rect(startX, y - 6, usableWidth, rowHeight, 'F');
  colunas.forEach((col, i) => {
    doc.text(String(col), startX + i * colWidth + 2, y);
  });
  y += rowHeight;

  doc.setFont(undefined, 'normal');
  doc.setTextColor(40, 40, 40);
  linhas.forEach((linha, ri) => {
    if (y > doc.internal.pageSize.getHeight() - 14) {
      doc.addPage();
      y = 20;
    }
    if (ri % 2 === 0) {
      doc.setFillColor(245, 250, 247);
      doc.rect(startX, y - 6, usableWidth, rowHeight, 'F');
    }
    linha.forEach((cell, ci) => {
      const text = String(cell ?? '');
      const truncated = text.length > 30 ? text.substring(0, 30) + '…' : text;
      doc.text(truncated, startX + ci * colWidth + 2, y);
    });
    y += rowHeight;
  });

  doc.save(`${titulo}.pdf`);
}

export function exportCSV(titulo, colunas, linhas) {
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csv = [
    colunas.map(escape).join(','),
    ...linhas.map((linha) => linha.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}