import { base44 } from '@/api/base44Client';
import { consumirFefo, setorControlaValidade } from '@/lib/lotes';
import { maxNumeroMovimento, formatarNumeroMov } from '@/lib/movimentacoes';

// Localiza o setor de combustíveis pelo nome (contém "combust").
export function findSetorCombustivel(setores) {
  return (setores || []).find((s) =>
    String(s?.nome || '').toLowerCase().includes('combust')
  );
}

export function produtosCombustivel(produtos, setorId) {
  if (!setorId) return [];
  return (produtos || []).filter((p) => p.setor_id === setorId);
}

// Registra um abastecimento: decrementa o estoque do combustível, cria uma
// movimentação de saída vinculada à máquina e grava o registro de abastecimento.
// Retorna o Abastecimento criado.
export async function registrarAbastecimento({
  maquina,
  produto,
  quantidade,
  observacao,
  operador,
  setores,
  lotes,
  movimentacoes,
}) {
  const qtd = Number(quantidade);
  if (!(qtd > 0)) throw new Error('Informe uma quantidade maior que zero.');

  const controla = setorControlaValidade(produto.setor_id, setores);
  const now = new Date().toISOString();
  const baseMov = {
    data: now,
    numero: formatarNumeroMov(maxNumeroMovimento(movimentacoes) + 1),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: qtd,
    setor_id: produto.setor_id,
    maquina_id: maquina.id,
    gaveta_id: produto.gaveta_id || '',
    tipo: 'saida',
    observacao: observacao || `Abastecimento — ${maquina.nome || maquina.codigo}`,
  };

  let mov;
  if (controla) {
    const lotesProduto = (lotes || []).filter((l) => l.produto_id === produto.id);
    const { alocacoes, totalDisponivel, suficiente } = consumirFefo(lotesProduto, qtd);
    if (!suficiente) {
      throw new Error(`Saldo insuficiente em lotes válidos. Disponível: ${totalDisponivel} ${produto.unidade || 'un'}.`);
    }
    for (const a of alocacoes) {
      const l = lotesProduto.find((x) => x.id === a.lote_id);
      const novaQtdLote = (l.quantidade || 0) - a.quantidade;
      await base44.entities.Lote.update(a.lote_id, {
        quantidade: novaQtdLote,
        ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}),
      });
    }
    mov = await base44.entities.Movimentacao.create({
      ...baseMov,
      lote_id: alocacoes[0]?.lote_id || '',
      data_validade: alocacoes[0]?.data_validade || '',
      lotes_consumidos: JSON.stringify(alocacoes),
    });
    const novaQtd = Math.max(0, lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0) - qtd);
    await base44.entities.Produto.update(produto.id, {
      quantidade: novaQtd,
      ...(novaQtd <= 0 ? { gaveta_id: '' } : {}),
    });
  } else {
    const disp = produto.quantidade || 0;
    if (qtd > disp) {
      throw new Error(`Saldo insuficiente. Disponível: ${disp} ${produto.unidade || 'un'}.`);
    }
    mov = await base44.entities.Movimentacao.create(baseMov);
    const novaQtd = Math.max(0, disp - qtd);
    await base44.entities.Produto.update(produto.id, {
      quantidade: novaQtd,
      ...(novaQtd <= 0 ? { gaveta_id: '' } : {}),
    });
  }

  const abast = await base44.entities.Abastecimento.create({
    data: now,
    maquina_id: maquina.id,
    produto_id: produto.id,
    quantidade: qtd,
    unidade: produto.unidade || 'un',
    operador: operador || '',
    numero_mov: mov.numero || '',
    observacao: observacao || '',
  });
  return { abast, mov };
}