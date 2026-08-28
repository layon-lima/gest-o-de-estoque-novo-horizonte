// Utilitários do módulo de Inventário (conferência tete-a-tete).
import { base44 } from '@/api/base44Client';
import { parseQtd } from '@/lib/format';
import { entrarSaldo, sairSaldo } from '@/lib/saldos';
import { maxNumeroMovimento, formatarNumeroMov } from '@/lib/movimentacoes';

// Gera o próximo número sequencial global de inventário (INV-000001).
export function nextInventarioNumber(inventarios = []) {
  let max = 0;
  inventarios.forEach((i) => {
    const m = String(i.numero || '').match(/INV-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `INV-${String(max + 1).padStart(6, '0')}`;
}

// Filtra os produtos de um setor pelos critérios selecionados (ao menos 1 obrigatório).
export function filterProdutosParaInventario(produtos, setorId, criterios, lotes = []) {
  return produtos
    .filter((p) => p.setor_id === setorId)
    .filter((p) => !criterios.deposito_id || p.deposito_id === criterios.deposito_id)
    .filter((p) => !criterios.gaveta_id || p.gaveta_id === criterios.gaveta_id)
    .filter((p) => !criterios.maquina_id || p.maquina_id === criterios.maquina_id);
}

// Estoque do sistema para um produto: soma dos lotes (FEFO) quando houver, senão quantidade direta.
export function qtdSistema(produto, lotes = []) {
  const lotesProd = (lotes || []).filter((l) => l.produto_id === produto.id && (Number(l.quantidade) || 0) > 0);
  if (lotesProd.length > 0) {
    return lotesProd.reduce((acc, l) => acc + (Number(l.quantidade) || 0), 0);
  }
  return Number(produto.quantidade) || 0;
}

// Aplica as divergências do inventário ao saldo real (SaldoEstoque), criando
// movimentações de ajuste (entrada para acréscimo, saída para baixa). Autocontida.
// `itens` = array consolidado (produto_id, qtd_sistema, qtd_contada, divergencia).
// `produtos` e `setor` (objeto Setor) para resolver depósito/unidade/validade.
// Retorna { aplicados, total }.
export async function aplicarAjusteInventario({ inventario, itens, produtos, setor }) {
  const divergentes = (itens || []).filter((it) => Math.abs(parseQtd(it.divergencia)) > 0.0001);
  if (divergentes.length === 0) return { aplicados: 0, total: 0 };

  const movimentacoes = await base44.entities.Movimentacao.list('-created_date', 100);
  let baseNum = maxNumeroMovimento(movimentacoes) + 1;
  const now = new Date().toISOString();
  const invLabel = inventario?.numero || '';
  const controla = !!setor?.controla_validade;
  let aplicados = 0;

  for (const it of divergentes) {
    const produto = (produtos || []).find((p) => p.id === it.produto_id);
    if (!produto) continue;
    const diff = parseQtd(it.divergencia);
    const abs = Math.abs(diff);

    const saldos = await base44.entities.SaldoEstoque.filter({ produto_id: produto.id });
    const depositoId = produto.deposito_id || saldos.find((s) => (s.quantidade || 0) > 0)?.deposito_id || '';
    if (!depositoId) continue; // sem depósito: ignora o ajuste deste item
    const gavetaId = produto.gaveta_id || '';
    const lotesProduto = controla ? await base44.entities.Lote.filter({ produto_id: produto.id }) : [];

    const baseMov = {
      data: now,
      numero: formatarNumeroMov(baseNum++),
      produto_id: produto.id,
      codigo: produto.codigo,
      nome_produto: produto.nome,
      quantidade: abs,
      setor_id: produto.setor_id,
      deposito_id: depositoId,
      maquina_id: produto.maquina_id || '',
      gaveta_id: gavetaId,
      observacao: `Ajuste de inventário — ${invLabel}`,
    };

    if (diff > 0) {
      await entrarSaldo({ produto, depositoId, gavetaId, quantidade: abs, unidade: produto.unidade || 'un', saldos });
      await base44.entities.Movimentacao.create({ ...baseMov, tipo: 'entrada' });
    } else {
      const { consumidos } = await sairSaldo({ produto, depositoId, gavetaId, quantidade: abs, lotes: lotesProduto, saldos });
      for (const c of consumidos) {
        const l = lotesProduto.find((x) => x.id === c.lote_id);
        if (l) {
          const novaQtdLote = (l.quantidade || 0) - c.quantidade;
          await base44.entities.Lote.update(l.id, { quantidade: novaQtdLote, ...(novaQtdLote <= 0 ? { gaveta_id: '' } : {}) });
        }
      }
      const primeiroLote = lotesProduto.find((l) => l.id === consumidos[0]?.lote_id);
      await base44.entities.Movimentacao.create({
        ...baseMov,
        tipo: 'saida',
        lote_id: consumidos[0]?.lote_id || '',
        data_validade: primeiroLote?.data_validade || '',
        lotes_consumidos: controla ? JSON.stringify(consumidos) : '',
      });
    }
    aplicados++;
  }

  return { aplicados, total: divergentes.length };
}

// Descrição legível dos critérios usados.
export function buildCriteriosDescricao(criterios, depositos = [], maquinas = [], gavetas = []) {
  const parts = [];
  if (criterios.deposito_id) {
    const d = depositos.find((x) => x.id === criterios.deposito_id);
    parts.push(`Depósito: ${d ? (d.nome ? `${d.numero} · ${d.nome}` : d.numero) : '—'}`);
  }
  if (criterios.gaveta_id) {
    const g = gavetas.find((x) => x.id === criterios.gaveta_id);
    parts.push(`Gaveta: ${g?.codigo || '—'}`);
  }
  if (criterios.maquina_id) {
    const m = maquinas.find((x) => x.id === criterios.maquina_id);
    parts.push(`Máquina: ${m ? `${m.codigo} · ${m.nome}` : '—'}`);
  }
  return parts.join(' | ') || 'Sem critérios';
}