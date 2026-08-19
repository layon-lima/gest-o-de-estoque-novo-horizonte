import { base44 } from '@/api/base44Client';

// Reverte o efeito de uma movimentação no estoque (produto e lotes),
// sem criar registro de auditoria. Usado tanto pelo estorno (que depois
// cria uma movimentação de estorno) quanto pela exclusão (que remove o registro).
// Retorna o maior número sequencial encontrado entre as movimentações,
// extraindo o sufixo numérico do campo "numero" (ex.: MOV-000012 -> 12).
export function maxNumeroMovimento(listaMovs) {
  let max = 0;
  for (const m of listaMovs || []) {
    const match = String(m?.numero || '').match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return max;
}

// Formata um número sequencial como identificador único de movimentação.
export function formatarNumeroMov(n) {
  return `MOV-${String(n).padStart(6, '0')}`;
}

// Limpa o vínculo de gaveta (endereço físico) quando o saldo zera.
// O estoque pertence ao Produto/Lote; a Gaveta é só o endereço. Sem saldo,
// a gaveta fica livre para receber outro produto.
// `novaQtdProduto` e `lotesAtualizados` permitem passar os saldos já calculados
// (evita releitura do banco). Retorna o produto atualizado (localmente).
export async function liberarGavetaSeZerado(produto, lotesDoProduto, novaQtdProduto) {
  if (!produto) return;
  const updates = [];
  // Lotes zerados perdem o endereço físico.
  for (const l of lotesDoProduto) {
    if ((l.quantidade || 0) <= 0 && l.gaveta_id) {
      updates.push(base44.entities.Lote.update(l.id, { gaveta_id: '' }));
      l.gaveta_id = '';
    }
  }
  // Produto sem saldo total também perde o endereço físico.
  if ((novaQtdProduto ?? produto.quantidade ?? 0) <= 0 && produto.gaveta_id) {
    updates.push(base44.entities.Produto.update(produto.id, { gaveta_id: '' }));
    produto.gaveta_id = '';
  }
  if (updates.length) await Promise.all(updates);
}

export async function reverterEstoqueMov(mov, { produtos, lotes }) {
  const produto = produtos.find((p) => p.id === mov.produto_id);

  if (mov.lote_id || mov.lotes_consumidos) {
    if (mov.tipo === 'entrada') {
      const lote = lotes.find((l) => l.id === mov.lote_id);
      if (lote) {
        const novaQtdLote = Math.max(0, (lote.quantidade || 0) - (mov.quantidade || 0));
        await base44.entities.Lote.update(lote.id, {
          quantidade: novaQtdLote,
          ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}),
        });
        lote.quantidade = novaQtdLote;
        if (novaQtdLote <= 0) lote.gaveta_id = '';
      }
    } else {
      const consumidos = mov.lotes_consumidos
        ? JSON.parse(mov.lotes_consumidos)
        : (mov.lote_id ? [{ lote_id: mov.lote_id, quantidade: mov.quantidade }] : []);
      for (const c of consumidos) {
        const l = lotes.find((x) => x.id === c.lote_id);
        if (l) {
          await base44.entities.Lote.update(l.id, { quantidade: (l.quantidade || 0) + c.quantidade });
          l.quantidade = (l.quantidade || 0) + c.quantidade;
        }
      }
    }
    if (produto) {
      const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
      let total = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0);
      total = mov.tipo === 'entrada' ? total - (mov.quantidade || 0) : total + (mov.quantidade || 0);
      total = Math.max(0, total);
      await base44.entities.Produto.update(produto.id, {
        quantidade: total,
        ...(total <= 0 ? { gaveta_id: '' } : {}),
      });
      produto.quantidade = total;
      if (total <= 0) produto.gaveta_id = '';
    }
  } else {
    if (produto) {
      const qtdAtual = produto.quantidade || 0;
      const novaQtd =
        mov.tipo === 'entrada'
          ? Math.max(0, qtdAtual - (mov.quantidade || 0))
          : qtdAtual + (mov.quantidade || 0);
      await base44.entities.Produto.update(produto.id, {
        quantidade: novaQtd,
        ...(novaQtd <= 0 ? { gaveta_id: '' } : {}),
      });
      produto.quantidade = novaQtd;
      if (novaQtd <= 0) produto.gaveta_id = '';
    }
  }
}