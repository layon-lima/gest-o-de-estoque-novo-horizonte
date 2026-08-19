import { base44 } from '@/api/base44Client';

// Reverte o efeito de uma movimentação no estoque (produto e lotes),
// sem criar registro de auditoria. Usado tanto pelo estorno (que depois
// cria uma movimentação de estorno) quanto pela exclusão (que remove o registro).
export async function reverterEstoqueMov(mov, { produtos, lotes }) {
  const produto = produtos.find((p) => p.id === mov.produto_id);

  if (mov.lote_id || mov.lotes_consumidos) {
    if (mov.tipo === 'entrada') {
      const lote = lotes.find((l) => l.id === mov.lote_id);
      if (lote) {
        const novaQtdLote = Math.max(0, (lote.quantidade || 0) - (mov.quantidade || 0));
        await base44.entities.Lote.update(lote.id, { quantidade: novaQtdLote });
      }
    } else {
      const consumidos = mov.lotes_consumidos
        ? JSON.parse(mov.lotes_consumidos)
        : (mov.lote_id ? [{ lote_id: mov.lote_id, quantidade: mov.quantidade }] : []);
      for (const c of consumidos) {
        const l = lotes.find((x) => x.id === c.lote_id);
        if (l) await base44.entities.Lote.update(l.id, { quantidade: (l.quantidade || 0) + c.quantidade });
      }
    }
    if (produto) {
      const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
      let total = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0);
      total = mov.tipo === 'entrada' ? total - (mov.quantidade || 0) : total + (mov.quantidade || 0);
      await base44.entities.Produto.update(produto.id, { quantidade: Math.max(0, total) });
    }
  } else {
    if (produto) {
      const qtdAtual = produto.quantidade || 0;
      const novaQtd =
        mov.tipo === 'entrada'
          ? Math.max(0, qtdAtual - (mov.quantidade || 0))
          : qtdAtual + (mov.quantidade || 0);
      await base44.entities.Produto.update(produto.id, { quantidade: novaQtd });
    }
  }
}