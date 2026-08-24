import { base44 } from '@/api/base44Client';
import { parseQtd } from '@/lib/format';
import { consumirFefo, proximoCodigoLote } from '@/lib/lotes';

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

// Registra uma movimentação de estoque (entrada/saída) com toda a lógica de
// lotes (FEFO), atualização de saldo do produto e numeração sequencial.
// Reutilizada pela aba Movimentações e pela aba mobile de Setores.
// `produto` e `lotes` são mutados localmente para refletir o novo estado.
// Lança erros sinalizadores: 'NF_DUPLICADA', 'VALIDADE_OBRIGATORIA',
// 'SALDO_INSUFICIENTE:<disp>' e 'Quantidade inválida.'.
export async function registrarMovimentacao({ form, produto, lotes, movimentacoes, controlaValidade }) {
  const qtd = parseQtd(form.quantidade);
  if (!(qtd > 0)) throw new Error('Quantidade inválida.');

  if (form.tipo === 'entrada' && form.chave_acesso) {
    const existentes = await base44.entities.Movimentacao.filter({ chave_acesso: form.chave_acesso });
    const ativas = existentes.filter((m) => m.tipo === 'entrada' && m.estornada !== true);
    if (ativas.length > 0) throw new Error('NF_DUPLICADA');
  }

  const now = new Date().toISOString();
  const baseMov = {
    data: now,
    numero: formatarNumeroMov(maxNumeroMovimento(movimentacoes) + 1),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: qtd,
    setor_id: produto.setor_id,
    maquina_id: produto.maquina_id,
    gaveta_id: produto.gaveta_id,
    tipo: form.tipo,
    observacao: form.observacao,
    numero_nf: form.tipo === 'entrada' ? (form.numero_nf || '') : '',
    fornecedor: form.tipo === 'entrada' ? (form.fornecedor || '') : '',
    chave_acesso: form.tipo === 'entrada' ? (form.chave_acesso || '') : '',
  };

  if (controlaValidade) {
    if (form.tipo === 'entrada') {
      if (!form.data_validade) throw new Error('VALIDADE_OBRIGATORIA');
      let lote = lotes.find((l) => l.produto_id === produto.id && l.data_validade === form.data_validade);
      let loteId;
      if (lote) {
        loteId = lote.id;
        await base44.entities.Lote.update(lote.id, { quantidade: (lote.quantidade || 0) + qtd });
        lote.quantidade = (lote.quantidade || 0) + qtd;
      } else {
        const created = await base44.entities.Lote.create({
          produto_id: produto.id,
          codigo_referencia: produto.codigo_referencia || '',
          setor_id: produto.setor_id,
          maquina_id: produto.maquina_id || '',
          gaveta_id: produto.gaveta_id || '',
          codigo_lote: proximoCodigoLote(produto, lotes),
          data_validade: form.data_validade,
          quantidade: qtd,
          unidade: produto.unidade || 'un',
        });
        loteId = created.id;
        lotes.push(created);
      }
      await base44.entities.Movimentacao.create({ ...baseMov, lote_id: loteId, data_validade: form.data_validade });
      const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
      const novaQtd = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0);
      await base44.entities.Produto.update(produto.id, { quantidade: novaQtd });
      produto.quantidade = novaQtd;
    } else {
      const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
      const { alocacoes, totalDisponivel, suficiente } = consumirFefo(lotesProduto, qtd);
      if (!suficiente) throw new Error(`SALDO_INSUFICIENTE:${totalDisponivel}`);
      for (const a of alocacoes) {
        const l = lotesProduto.find((x) => x.id === a.lote_id);
        const novaQtdLote = (l.quantidade || 0) - a.quantidade;
        await base44.entities.Lote.update(a.lote_id, {
          quantidade: novaQtdLote,
          ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}),
        });
        l.quantidade = novaQtdLote;
        if (novaQtdLote <= 0) l.gaveta_id = '';
      }
      await base44.entities.Movimentacao.create({
        ...baseMov,
        lote_id: alocacoes[0]?.lote_id || '',
        data_validade: alocacoes[0]?.data_validade || '',
        lotes_consumidos: JSON.stringify(alocacoes),
      });
      const novaQtd = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0) - qtd;
      const totalFinal = Math.max(0, novaQtd);
      await base44.entities.Produto.update(produto.id, {
        quantidade: totalFinal,
        ...(totalFinal <= 0 ? { gaveta_id: '' } : {}),
      });
      produto.quantidade = totalFinal;
      if (totalFinal <= 0) produto.gaveta_id = '';
    }
  } else {
    await base44.entities.Movimentacao.create(baseMov);
    const novaQtd =
      form.tipo === 'entrada'
        ? (produto.quantidade || 0) + qtd
        : Math.max(0, (produto.quantidade || 0) - qtd);
    await base44.entities.Produto.update(produto.id, {
      quantidade: novaQtd,
      ...(novaQtd <= 0 ? { gaveta_id: '' } : {}),
    });
    produto.quantidade = novaQtd;
    if (novaQtd <= 0) produto.gaveta_id = '';
  }
  return { produto };
}