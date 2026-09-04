import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Job de verificação de consistência de estoque.
// Compara SaldoEstoque (fonte única da verdade) contra a soma das Movimentações
// confirmadas (entradas +, saídas -, ignorando estorno/estornadas/sem depósito),
// APENAS para produtos que possuem movimentação. Produtos com saldo mas sem
// nenhuma movimentação não são divergência (são auditoria faltante histórica).
// Se houver divergências, envia e-mail de alerta a todos os admins.
// Pode ser invocada por workflow agendado (sem usuário) ou manualmente por admin.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Se houver usuário (chamada manual via SDK), exige admin.
    // Chamadas agendadas (workflow) não têm usuário — prossegue com service role.
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user !== null && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const [movs, saldos, users, produtos] = await Promise.all([
      svc.entities.Movimentacao.list('-created_date', 5000),
      svc.entities.SaldoEstoque.list('-created_date', 5000),
      svc.entities.User.list('-created_date', 500),
      svc.entities.Produto.list('-created_date', 5000),
    ]);

    // Autocorreção: ressync produto.quantidade = soma de SaldoEstoque.
    // Garante que TODA tela que exibe produto.quantidade mostre o saldo real,
    // mesmo se algum fluxo bypassar o recalc do saldos.js (máx. 1h de defasagem).
    const saldoMap = {};
    for (const s of (saldos || [])) saldoMap[s.produto_id] = (saldoMap[s.produto_id] || 0) + (Number(s.quantidade) || 0);
    const resyncUpdates = [];
    let resyncAlterados = 0;
    for (const p of (produtos || [])) {
      const real = Math.round((saldoMap[p.id] || 0) * 1000) / 1000;
      const atual = Number(p.quantidade) || 0;
      if (real !== atual) {
        resyncUpdates.push({ id: p.id, quantidade: real });
        resyncAlterados++;
      }
    }
    if (resyncUpdates.length) {
      try { await svc.entities.Produto.bulkUpdate(resyncUpdates); } catch {}
    }

    // Saldo esperado por produto a partir das movimentações.
    const esperado = {};
    let entradas = 0, saidas = 0, ignoradas = 0;
    for (const m of (movs || [])) {
      if (m.tipo === 'estorno' || m.estornada === true || !m.deposito_id) { ignoradas++; continue; }
      const sinal = m.tipo === 'entrada' ? 1 : -1;
      if (sinal > 0) entradas++; else saidas++;
      esperado[m.produto_id] = (esperado[m.produto_id] || 0) + sinal * (Number(m.quantidade) || 0);
    }

    // Saldo atual por produto (soma das parcelas em SaldoEstoque).
    const atual = {};
    for (const s of (saldos || [])) {
      atual[s.produto_id] = (atual[s.produto_id] || 0) + (Number(s.quantidade) || 0);
    }

    // Divergências apenas para produtos QUE TÊM movimentação.
    const divergencias = [];
    for (const pid of Object.keys(esperado)) {
      const diff = Math.round(((atual[pid] || 0) - esperado[pid]) * 1000) / 1000;
      if (diff !== 0) {
        divergencias.push({
          produto_id: pid,
          saldo_atual: atual[pid] || 0,
          saldo_esperado: esperado[pid],
          divergencia: diff,
        });
      }
    }

    const resumo = {
      verificado_em: new Date().toISOString(),
      total_movimentacoes: (movs || []).length,
      entradas,
      saidas,
      ignoradas,
      total_parcelas_saldo: (saldos || []).length,
      produtos_com_movimentacao: Object.keys(esperado).length,
      produtos_com_divergencia: divergencias.length,
      resync_produto_quantidade: { alterados: resyncAlterados, total_produtos: (produtos || []).length },
    };

    // Alerta por e-mail aos admins se houver divergência.
    if (divergencias.length > 0) {
      const admins = (users || []).filter((u) => u.role === 'admin' && u.email);
      const linhas = divergencias.slice(0, 50).map((d) =>
        `${d.produto_id}: atual ${d.saldo_atual} | esperado ${d.saldo_esperado} | diff ${d.divergencia}`
      ).join('\n');
      const corpo = `Verificação de consistência de estoque encontrou ${divergencias.length} divergência(s).\n\n` +
        `Resumo: ${JSON.stringify(resumo, null, 2)}\n\nDivergências:\n${linhas}`;
      for (const adm of admins) {
        try {
          await svc.integrations.Core.SendEmail({
            to: adm.email,
            subject: `[Estoque] ${divergencias.length} divergência(s) detectada(s)`,
            body: corpo,
          });
        } catch {}
      }
    }

    return Response.json({ ...resumo, divergencias: divergencias.slice(0, 50) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}