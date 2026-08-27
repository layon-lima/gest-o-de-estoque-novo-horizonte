import { base44 } from '@/api/base44Client';
import { parseQtd } from '@/lib/format';
import { proximoCodigoLote } from '@/lib/lotes';
import { entrarSaldo, sairSaldo, reverterSaldoMov, transferirSaldo } from '@/lib/saldos';

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
export async function liberarGavetaSeZerado(produto, lotesDoProduto, novaQtdProduto) {
  if (!produto) return;
  const updates = [];
  for (const l of lotesDoProduto) {
    if ((l.quantidade || 0) <= 0 && l.gaveta_id) {
      updates.push(base44.entities.Lote.update(l.id, { gaveta_id: '' }));
      l.gaveta_id = '';
    }
  }
  if ((novaQtdProduto ?? produto.quantidade ?? 0) <= 0 && produto.gaveta_id) {
    updates.push(base44.entities.Produto.update(produto.id, { gaveta_id: '' }));
    produto.gaveta_id = '';
  }
  if (updates.length) await Promise.all(updates);
}

// Reverte o efeito de uma movimentação no saldo + lotes.
export async function reverterEstoqueMov(mov, { produtos, lotes, saldos }) {
  // 1. Reverter saldos (atualiza SaldoEstoque + recalcula Produto.quantidade)
  await reverterSaldoMov(mov, { saldos });

  // 2. Reverter lotes (denormalizado, para compatibilidade com views de validade)
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
  }

  // 3. Sincronizar produto localmente
  const produto = produtos.find((p) => p.id === mov.produto_id);
  if (produto) {
    const saldosProduto = (saldos || []).filter((s) => s.produto_id === produto.id);
    produto.quantidade = saldosProduto.reduce((s, sl) => s + (sl.quantidade || 0), 0);
    if (produto.quantidade <= 0) produto.gaveta_id = '';
  }
}

// Registra uma movimentação de estoque (entrada/saída) com toda a lógica de
// saldos multi-depósito + lotes (FEFO) + numeração sequencial.
// `produto`, `lotes` e `saldos` são mutados localmente para refletir o novo estado.
// Lança erros sinalizadores: 'NF_DUPLICADA', 'VALIDADE_OBRIGATORIA',
// 'DEPOSITO_OBRIGATORIO', 'SALDO_INSUFICIENTE:<disp>' e 'Quantidade inválida.'.
export async function registrarMovimentacao({ form, produto, lotes, saldos, movimentacoes, controlaValidade }) {
  const qtd = parseQtd(form.quantidade);
  if (!(qtd > 0)) throw new Error('Quantidade inválida.');

  if (form.tipo === 'entrada' && form.chave_acesso) {
    const existentes = await base44.entities.Movimentacao.filter({ chave_acesso: form.chave_acesso });
    const ativas = existentes.filter((m) => m.tipo === 'entrada' && m.estornada !== true);
    if (ativas.length > 0) throw new Error('NF_DUPLICADA');
  }

  const depositoId = form.deposito_id || produto.deposito_id || '';
  const gavetaId = form.gaveta_id || produto.gaveta_id || '';
  if (!depositoId) throw new Error('DEPOSITO_OBRIGATORIO');

  const now = new Date().toISOString();
  const baseMov = {
    data: now,
    numero: formatarNumeroMov(maxNumeroMovimento(movimentacoes) + 1),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: qtd,
    setor_id: produto.setor_id,
    deposito_id: depositoId,
    maquina_id: produto.maquina_id,
    gaveta_id: gavetaId,
    tipo: form.tipo,
    observacao: form.observacao,
    numero_nf: form.tipo === 'entrada' ? (form.numero_nf || '') : '',
    fornecedor: form.tipo === 'entrada' ? (form.fornecedor || '') : '',
    chave_acesso: form.tipo === 'entrada' ? (form.chave_acesso || '') : '',
  };

  if (controlaValidade) {
    if (form.tipo === 'entrada') {
      if (!form.data_validade) throw new Error('VALIDADE_OBRIGATORIA');
      let lote = lotes.find((l) => l.produto_id === produto.id && l.data_validade === form.data_validade && (l.deposito_id || '') === depositoId);
      let loteId;
      if (lote) {
        loteId = lote.id;
        await base44.entities.Lote.update(lote.id, { quantidade: (lote.quantidade || 0) + qtd, deposito_id: depositoId, gaveta_id: gavetaId || lote.gaveta_id });
        lote.quantidade = (lote.quantidade || 0) + qtd;
        lote.deposito_id = depositoId;
      } else {
        const created = await base44.entities.Lote.create({
          produto_id: produto.id,
          codigo_referencia: produto.codigo_referencia || '',
          setor_id: produto.setor_id,
          deposito_id: depositoId,
          maquina_id: produto.maquina_id || '',
          gaveta_id: gavetaId || '',
          codigo_lote: proximoCodigoLote(produto, lotes),
          data_validade: form.data_validade,
          quantidade: qtd,
          unidade: produto.unidade || 'un',
        });
        loteId = created.id;
        lotes.push(created);
      }
      await entrarSaldo({ produto, depositoId, gavetaId, loteId, quantidade: qtd, unidade: produto.unidade || 'un', saldos });
      await base44.entities.Movimentacao.create({ ...baseMov, lote_id: loteId, data_validade: form.data_validade });
    } else {
      const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
      const { consumidos, totalDisponivel, suficiente } = await sairSaldo({ produto, depositoId, gavetaId, quantidade: qtd, lotes: lotesProduto, saldos });
      if (!suficiente) throw new Error(`SALDO_INSUFICIENTE:${totalDisponivel}`);
      for (const c of consumidos) {
        const l = lotesProduto.find((x) => x.id === c.lote_id);
        if (l) {
          const novaQtdLote = (l.quantidade || 0) - c.quantidade;
          await base44.entities.Lote.update(l.id, { quantidade: novaQtdLote, ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}) });
          l.quantidade = novaQtdLote;
          if (novaQtdLote <= 0) l.gaveta_id = '';
        }
      }
      const primeiroLote = lotesProduto.find((l) => l.id === consumidos[0]?.lote_id);
      await base44.entities.Movimentacao.create({
        ...baseMov,
        lote_id: consumidos[0]?.lote_id || '',
        data_validade: primeiroLote?.data_validade || '',
        lotes_consumidos: JSON.stringify(consumidos),
      });
    }
  } else {
    if (form.tipo === 'entrada') {
      await entrarSaldo({ produto, depositoId, gavetaId, quantidade: qtd, unidade: produto.unidade || 'un', saldos });
    } else {
      const lotesProduto = lotes.filter((l) => l.produto_id === produto.id);
      const { totalDisponivel, suficiente } = await sairSaldo({ produto, depositoId, gavetaId, quantidade: qtd, lotes: lotesProduto, saldos });
      if (!suficiente) throw new Error(`SALDO_INSUFICIENTE:${totalDisponivel}`);
    }
    await base44.entities.Movimentacao.create(baseMov);
  }

  // Sincroniza produto localmente
  const saldosProduto = (saldos || []).filter((s) => s.produto_id === produto.id);
  produto.quantidade = saldosProduto.reduce((s, sl) => s + (sl.quantidade || 0), 0);
  return { produto };
}

// Registra uma transferência interna entre depósitos: cria duas movimentações
// (saída da origem + entrada no destino) e move os saldos preservando lotes.
// `form` deve conter: produto_id, deposito_origem_id, gaveta_origem_id,
// deposito_destino_id, gaveta_destino_id, quantidade, observacao.
// `depositos` é a lista de depósitos para formatar os labels na observação.
export async function registrarTransferencia({ form, produto, lotes, saldos, movimentacoes, controlaValidade, depositos }) {
  const qtd = parseQtd(form.quantidade);
  if (!(qtd > 0)) throw new Error('Quantidade inválida.');

  const depOrigem = depositos.find((d) => d.id === form.deposito_origem_id);
  const depDest = depositos.find((d) => d.id === form.deposito_destino_id);
  const labelOrigem = depOrigem ? `${depOrigem.numero}${depOrigem.nome ? ' · ' + depOrigem.nome : ''}` : 'depósito de origem';
  const labelDestino = depDest ? `${depDest.numero}${depDest.nome ? ' · ' + depDest.nome : ''}` : 'depósito de destino';

  const { consumidos } = await transferirSaldo({
    produto,
    depositoOrigemId: form.deposito_origem_id,
    gavetaOrigemId: form.gaveta_origem_id || '',
    depositoDestinoId: form.deposito_destino_id,
    gavetaDestinoId: form.gaveta_destino_id || '',
    quantidade: qtd,
    lotes,
    saldos,
  });

  const now = new Date().toISOString();
  const baseNum = maxNumeroMovimento(movimentacoes) + 1;
  const obs = form.observacao ? ` — ${form.observacao}` : '';
  const lotesJson = consumidos.length > 0 ? JSON.stringify(consumidos) : '';
  const primeiroLoteId = consumidos[0]?.lote_id || '';
  const primeiroLote = (lotes || []).find((l) => l.id === primeiroLoteId);

  // Movimentação de SAÍDA (origem)
  await base44.entities.Movimentacao.create({
    data: now,
    numero: formatarNumeroMov(baseNum),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: qtd,
    setor_id: produto.setor_id,
    deposito_id: form.deposito_origem_id,
    maquina_id: produto.maquina_id || '',
    gaveta_id: form.gaveta_origem_id || '',
    tipo: 'saida',
    observacao: `Transferência → ${labelDestino}${obs}`,
    ...(controlaValidade && lotesJson ? { lotes_consumidos: lotesJson, lote_id: primeiroLoteId, data_validade: primeiroLote?.data_validade || '' } : {}),
  });

  // Movimentação de ENTRADA (destino)
  await base44.entities.Movimentacao.create({
    data: now,
    numero: formatarNumeroMov(baseNum + 1),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: qtd,
    setor_id: produto.setor_id,
    deposito_id: form.deposito_destino_id,
    maquina_id: produto.maquina_id || '',
    gaveta_id: form.gaveta_destino_id || '',
    tipo: 'entrada',
    observacao: `Transferência ← ${labelOrigem}${obs}`,
    ...(controlaValidade && primeiroLoteId ? { lote_id: primeiroLoteId, data_validade: primeiroLote?.data_validade || '', lotes_consumidos: lotesJson } : {}),
  });

  // Sincroniza produto localmente
  const saldosProduto = (saldos || []).filter((s) => s.produto_id === produto.id);
  produto.quantidade = saldosProduto.reduce((s, sl) => s + (sl.quantidade || 0), 0);
  return { produto };
}

// Move TODO o saldo de um produto do depósito/gaveta antigo para o novo quando
// o endereço físico é alterado no cadastro do produto. Preserva lotes (FEFO) e
// gera movimentações de transferência (saída + entrada) para auditoria.
// Retorna { movido, quantidade }. Não faz nada se não houver saldo no local antigo.
export async function relocarSaldoCadastro({ produto, oldDepositoId, oldGavetaId = '', newDepositoId, newGavetaId = '', controlaValidade, depositos = [] }) {
  if (!oldDepositoId || !newDepositoId) return { movido: false, quantidade: 0 };
  if (oldDepositoId === newDepositoId && (oldGavetaId || '') === (newGavetaId || '')) return { movido: false, quantidade: 0 };

  const saldos = await base44.entities.SaldoEstoque.filter({ produto_id: produto.id });
  const totalMover = saldos
    .filter((s) => s.deposito_id === oldDepositoId && (s.gaveta_id || '') === (oldGavetaId || '') && (s.quantidade || 0) > 0)
    .reduce((sum, s) => sum + (s.quantidade || 0), 0);
  if (totalMover <= 0) return { movido: false, quantidade: 0 };

  const lotes = controlaValidade ? await base44.entities.Lote.filter({ produto_id: produto.id }) : [];
  const movimentacoes = await base44.entities.Movimentacao.list('-created_date', 100);

  await registrarTransferencia({
    form: {
      deposito_origem_id: oldDepositoId,
      gaveta_origem_id: oldGavetaId,
      deposito_destino_id: newDepositoId,
      gaveta_destino_id: newGavetaId,
      quantidade: totalMover,
      observacao: 'Realocação via cadastro de produto',
    },
    produto,
    lotes,
    saldos,
    movimentacoes,
    controlaValidade,
    depositos,
  });

  return { movido: true, quantidade: totalMover };
}