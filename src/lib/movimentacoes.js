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

// Move TODO o saldo de um produto para o endereço físico definido no cadastro
// (depósito + gaveta). A ORIGEM DA VERDADE é o SaldoEstoque real — não o campo
// produto.deposito_id, que pode estar vazio ou desatualizado. Por isso move
// TODAS as parcelas do produto que NÃO estejam ainda no endereço destino,
// mesclando para evitar duplicação. Preserva lotes (FEFO) e gera movimentações
// de auditoria (uma saída por depósito de origem + uma entrada no destino).
// Retorna { movido, quantidade }. No-op se não houver saldo fora do destino.
export async function relocarSaldoCadastro({ produto, newDepositoId, newGavetaId = '', controlaValidade, depositos = [] }) {
  if (!newDepositoId) return { movido: false, quantidade: 0 };
  const newGav = newGavetaId || '';

  const saldos = await base44.entities.SaldoEstoque.filter({ produto_id: produto.id });
  const local = saldos.map((s) => ({ ...s }));
  const isAtTarget = (s) => s.deposito_id === newDepositoId && (s.gaveta_id || '') === newGav;
  // Parcelas com saldo positivo que NÃO estão no endereço destino.
  const parcelas = local.filter((s) => !isAtTarget(s) && (s.quantidade || 0) > 0);
  const totalMover = parcelas.reduce((sum, s) => sum + (s.quantidade || 0), 0);
  if (totalMover <= 0) return { movido: false, quantidade: 0 };

  // Agrupa por depósito de origem para a auditoria (saída por origem).
  const porOrigem = {};
  for (const s of parcelas) {
    const k = s.deposito_id || '';
    porOrigem[k] = (porOrigem[k] || 0) + (s.quantidade || 0);
  }

  const alvo = local.filter((s) => isAtTarget(s));

  // Fase 1: mesclar parcelas em saldo já existente no destino (mesmo lote).
  const restantes = [];
  for (const s of parcelas) {
    const dest = alvo.find((x) => (x.lote_id || '') === (s.lote_id || ''));
    if (dest) {
      dest.quantidade = (dest.quantidade || 0) + (s.quantidade || 0);
      await base44.entities.SaldoEstoque.update(dest.id, { quantidade: dest.quantidade });
      await base44.entities.SaldoEstoque.delete(s.id);
    } else {
      restantes.push(s);
    }
  }

  // Fase 2: entre as restantes, consolidar por lote e mover para o destino.
  const porLote = new Map();
  for (const s of restantes) {
    const k = s.lote_id || '';
    if (!porLote.has(k)) porLote.set(k, []);
    porLote.get(k).push(s);
  }
  for (const [, grupo] of porLote) {
    const [primeiro, ...outros] = grupo;
    await base44.entities.SaldoEstoque.update(primeiro.id, { deposito_id: newDepositoId, gaveta_id: newGav });
    primeiro.deposito_id = newDepositoId;
    primeiro.gaveta_id = newGav;
    for (const s of outros) {
      primeiro.quantidade = (primeiro.quantidade || 0) + (s.quantidade || 0);
      await base44.entities.SaldoEstoque.update(primeiro.id, { quantidade: primeiro.quantidade });
      await base44.entities.SaldoEstoque.delete(s.id);
    }
  }

  // Lotes do produto também mudam para o novo endereço (FEFO).
  if (controlaValidade) {
    const lotes = await base44.entities.Lote.filter({ produto_id: produto.id });
    await Promise.all(
      lotes
        .filter((l) => l.deposito_id !== newDepositoId || (l.gaveta_id || '') !== newGav)
        .map((l) => base44.entities.Lote.update(l.id, { deposito_id: newDepositoId, gaveta_id: newGav }))
    );
  }

  // Auditoria: uma saída por depósito de origem + uma entrada no destino.
  const movimentacoes = await base44.entities.Movimentacao.list('-created_date', 100);
  const depDest = depositos.find((d) => d.id === newDepositoId);
  const labelDestino = depDest ? `${depDest.numero}${depDest.nome ? ' · ' + depDest.nome : ''}` : 'depósito de destino';
  let baseNum = maxNumeroMovimento(movimentacoes) + 1;
  const now = new Date().toISOString();
  const labelsOrigem = [];
  for (const [origemId, qtd] of Object.entries(porOrigem)) {
    const depO = depositos.find((d) => d.id === origemId);
    const labelO = depO ? `${depO.numero}${depO.nome ? ' · ' + depO.nome : ''}` : 'depósito de origem';
    labelsOrigem.push(labelO);
    await base44.entities.Movimentacao.create({
      data: now,
      numero: formatarNumeroMov(baseNum++),
      produto_id: produto.id,
      codigo: produto.codigo,
      nome_produto: produto.nome,
      quantidade: qtd,
      setor_id: produto.setor_id,
      deposito_id: origemId,
      maquina_id: produto.maquina_id || '',
      gaveta_id: '',
      tipo: 'saida',
      observacao: `Transferência → ${labelDestino} (realocação via cadastro)`,
    });
  }
  await base44.entities.Movimentacao.create({
    data: now,
    numero: formatarNumeroMov(baseNum),
    produto_id: produto.id,
    codigo: produto.codigo,
    nome_produto: produto.nome,
    quantidade: totalMover,
    setor_id: produto.setor_id,
    deposito_id: newDepositoId,
    maquina_id: produto.maquina_id || '',
    gaveta_id: newGav,
    tipo: 'entrada',
    observacao: `Transferência ← ${labelsOrigem.join(', ')} (realocação via cadastro)`,
  });

  return { movido: true, quantidade: totalMover };
}

// Estorna uma movimentação de estoque: reverte o efeito no saldo/lotes,
// marca a movimentação original como estornada e cria uma movimentação de
// estorno vinculada (tipo 'estorno', estorno_de = id da original).
// Regras: a original precisa existir, possuir id, não estar estornada e não
// ser ela própria uma movimentação de estorno.
export async function estornarMovimentacao(mov, { produtos, lotes, saldos, movimentacoes }) {
  if (!mov || !mov.id) throw new Error('ESTORNO_NAO_EXISTE');
  if (mov.tipo === 'estorno') throw new Error('ESTORNO_TIPO_ESTORNO');
  if (mov.estornada === true) throw new Error('ESTORNO_JA_ESTORNADA');

  // 1. Reverter o efeito no estoque (saldo + lotes).
  await reverterEstoqueMov(mov, { produtos, lotes, saldos });

  // 2. Marcar a original como estornada.
  await base44.entities.Movimentacao.update(mov.id, { estornada: true });
  mov.estornada = true;

  // 3. Criar a movimentação de estorno vinculada (auditoria).
  const now = new Date().toISOString();
  const baseNum = maxNumeroMovimento(movimentacoes) + 1;
  await base44.entities.Movimentacao.create({
    data: now,
    numero: formatarNumeroMov(baseNum),
    produto_id: mov.produto_id,
    codigo: mov.codigo,
    nome_produto: mov.nome_produto,
    quantidade: mov.quantidade,
    custo_unitario: 0,
    valor_movimentado: 0,
    setor_id: mov.setor_id,
    deposito_id: mov.deposito_id,
    maquina_id: mov.maquina_id || '',
    gaveta_id: mov.gaveta_id || '',
    tipo: 'estorno',
    estorno_de: mov.id,
    estornada: false,
    observacao: `Estorno de ${mov.numero || ''}${mov.observacao ? ' — ' + mov.observacao : ''}`,
    ...(mov.lote_id ? { lote_id: mov.lote_id } : {}),
    ...(mov.data_validade ? { data_validade: mov.data_validade } : {}),
    ...(mov.lotes_consumidos ? { lotes_consumidos: mov.lotes_consumidos } : {}),
  });
}