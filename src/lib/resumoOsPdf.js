// Geração de PDF do resumo de OS selecionadas: lista as lavouras e, para cada
// uma, uma linha por produto com o total previsto somado de todas as OS.
import { jsPDF } from 'jspdf';
import { formatQtd } from '@/lib/format';
import { parseItens } from '@/lib/osAplicacao';

export function gerarPDFResumoOS(ordens) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 16;

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('RESUMO DE OS DE APLICAÇÃO', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${(ordens || []).length} OS selecionadas · gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageW / 2,
    y,
    { align: 'center' }
  );
  y += 6;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // Agrupa produtos por lavoura somando o previsto de todas as OS.
  const porLavoura = {};
  for (const os of ordens || []) {
    const key = os.lavoura_id || '_sem';
    if (!porLavoura[key]) {
      porLavoura[key] = {
        nome: os.lavoura_nome || 'Sem lavoura',
        cultura: os.cultura_nome || '',
        ano_safra: os.ano_safra || '',
        produtos: {},
      };
    }
    for (const it of parseItens(os.itens)) {
      if (!porLavoura[key].produtos[it.produto_id]) {
        porLavoura[key].produtos[it.produto_id] = {
          nome: it.nome,
          codigo: it.codigo,
          unidade: it.unidade || 'un',
          total: 0,
        };
      }
      porLavoura[key].produtos[it.produto_id].total += Number(it.previsto) || 0;
    }
  }
  const lavouras = Object.values(porLavoura).map((l) => ({
    ...l,
    produtos: Object.values(l.produtos).sort((a, b) => a.nome.localeCompare(b.nome)),
  }));
  lavouras.sort((a, b) => a.nome.localeCompare(b.nome));

  const colProduto = margin;
  const colCod = 120;
  const colUn = 162;
  const colTotal = pageW - margin;

  for (const l of lavouras) {
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(l.nome, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const sub = [l.cultura, l.ano_safra].filter(Boolean).join(' · ');
    if (sub) doc.text(sub, margin + 75, y);
    y += 5;

    // Cabeçalho da tabela
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, contentW, 6, 'F');
    doc.setFontSize(9);
    doc.text('Produto', colProduto, y);
    doc.text('Código', colCod, y);
    doc.text('Un.', colUn, y);
    doc.text('Total', colTotal, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    for (const p of l.produtos) {
      if (y > 282) {
        doc.addPage();
        y = 16;
      }
      doc.text(String(p.nome || '').slice(0, 52), colProduto, y);
      doc.text(String(p.codigo || ''), colCod, y);
      doc.text(p.unidade, colUn, y);
      doc.text(formatQtd(p.total), colTotal, y, { align: 'right' });
      y += 5.5;
    }
    y += 5;
  }

  doc.save('Resumo-OS-Aplicacao.pdf');
}