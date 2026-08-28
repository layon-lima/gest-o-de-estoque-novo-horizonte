// Sincronização: processa a fila de operações pendentes quando volta online.
// Re-busca dados frescos para operações compostas (confirmar abastecimento, fechar ticket).
import { base44 } from '@/api/base44Client';
import { getPendingOps, removeOp, emitChange, isOnline, isNetworkError } from '@/lib/offlineCore';
import { queryClientInstance } from '@/lib/query-client';
import { toast } from '@/components/ui/use-toast';
import { confirmarAbastecimento } from '@/lib/abastecimento';
import { fecharTicket } from '@/lib/pesagem';

let flushing = false;
export function isFlushing() { return flushing; }

export async function flushQueue() {
  if (flushing) return;
  if (!isOnline()) return;
  flushing = true;
  emitChange();

  let synced = 0;
  let failed = 0;
  const toInvalidate = new Set();

  try {
    const ops = await getPendingOps();
    for (const op of ops) {
      try {
        await replayOp(op);
        await removeOp(op.id);
        synced++;
        if (op.entity) toInvalidate.add(op.entity);
        if (op.compoundType === 'confirmar_abastecimento') {
          toInvalidate.add('Abastecimento');
          toInvalidate.add('Movimentacao');
          toInvalidate.add('SaldoEstoque');
          toInvalidate.add('Lote');
        }
        if (op.compoundType === 'fechar_ticket') {
          toInvalidate.add('TicketPesagem');
          toInvalidate.add('PedidoPesagem');
          toInvalidate.add('Movimentacao');
          toInvalidate.add('SaldoEstoque');
          toInvalidate.add('Lote');
        }
      } catch (e) {
        if (isNetworkError(e)) break; // ainda sem conexão, parar
        // Erro não-rede (validação, conflito): remove e conta como falha
        await removeOp(op.id);
        failed++;
      }
    }
  } finally {
    flushing = false;
    emitChange();
  }

  // Invalida caches para refetch com dados reais
  toInvalidate.forEach((name) => {
    queryClientInstance.invalidateQueries({ queryKey: ['ent', name] });
  });

  if (synced > 0) {
    toast({ title: 'Sincronização concluída', description: `${synced} operação(ões) enviada(s).` });
  }
  if (failed > 0) {
    toast({ variant: 'destructive', title: 'Falha na sincronização', description: `${failed} operação(ões) não puderam ser sincronizadas.` });
  }
}

async function replayOp(op) {
  if (op.type === 'create') {
    await base44.entities[op.entity].create(op.data);
  } else if (op.type === 'update') {
    await base44.entities[op.entity].update(op.recordId, op.data);
  } else if (op.type === 'compound') {
    if (op.compoundType === 'confirmar_abastecimento') {
      await replayConfirmarAbastecimento(op.compoundData);
    } else if (op.compoundType === 'fechar_ticket') {
      await replayFecharTicket(op.compoundData);
    }
  }
}

async function replayConfirmarAbastecimento(data) {
  const abast = await base44.entities.Abastecimento.get(data.abastId);
  if (!abast || abast.status !== 'pendente') return; // já processado ou excluído
  const maquina = await base44.entities.Maquina.get(abast.maquina_id);
  const produto = await base44.entities.Produto.get(abast.produto_id);
  const setores = await base44.entities.Setor.list();
  const lotes = await base44.entities.Lote.filter({ produto_id: produto.id });
  const saldos = await base44.entities.SaldoEstoque.filter({ produto_id: produto.id });
  const movimentacoes = await base44.entities.Movimentacao.list('-created_date', 100);
  await confirmarAbastecimento({
    abast, maquina, produto,
    confirmado_por: data.confirmado_por || '',
    setores, lotes, saldos, movimentacoes,
  });
}

async function replayFecharTicket(data) {
  const ticket = await base44.entities.TicketPesagem.get(data.ticketId);
  if (!ticket || ticket.status === 'fechado') return; // já fechado
  const pedidos = data.isVenda ? await base44.entities.PedidoPesagem.list() : [];
  const produtos = await base44.entities.Produto.list();
  const transportadoras = await base44.entities.Transportadora.list();
  const pessoas = await base44.entities.Pessoa.list();

  const pedidoSel = data.pedidoId ? pedidos.find((p) => p.id === data.pedidoId) : null;
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const transpNome = (id) => transportadoras.find((t) => t.id === id)?.nome || '—';

  await fecharTicket({
    ticket,
    pesoBruto: data.pesoBruto,
    isInverted: data.isInverted,
    liquido: data.liquido,
    isVenda: data.isVenda,
    pedidoId: data.pedidoId,
    transportadoraId: data.transportadoraId,
    observacao: data.observacao,
    pedidoSel,
    clienteNome,
    transpNome,
    produtos,
  });
}