// Utilitários do módulo de Inventário (conferência tete-a-tete).
import { estoqueApi } from '@/api/estoqueClient';
import { parseQtd } from '@/lib/format';
import { construirItensSaida } from '@/lib/estoqueOperacoes';
import { invalidateEntidade } from '@/lib/useEntidades';

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
export async function aplicarAjusteInventario({
  inventario,
  itens,
  produtos,
  setor,
}) {
  const divergentes =
    (itens || []).filter(
      (item) =>
        Math.abs(
          parseQtd(item.divergencia)
        ) > 0.0001
    );

  if (divergentes.length === 0) {
    return {
      aplicados: 0,
      total: 0,
    };
  }

  const positivos = [];
  const negativos = [];
  let aplicados = 0;

  const invLabel =
    inventario?.numero || '';

  const origemBase =
    inventario?.id ||
    inventario?.numero;

  if (!origemBase) {
    throw new Error(
      'Inventário sem identificador.'
    );
  }

  const controlaValidade =
    !!setor?.controla_validade;

  for (const item of divergentes) {
    const produto =
      (produtos || []).find(
        (p) =>
          p.id === item.produto_id
      );

    if (!produto) {
      continue;
    }

    const diff =
      parseQtd(item.divergencia);

    const quantidade =
      Math.abs(diff);

    const saldos =
      await estoqueApi.listarSaldos({
        produto_id: produto.id,
      });

    const livres =
      (saldos || []).filter(
        (saldo) =>
          (saldo.tipo_estoque || 'livre')
            === 'livre'
      );

    const preferido =
      livres.find(
        (saldo) =>
          saldo.deposito_id
            === produto.deposito_id &&
          (saldo.gaveta_id || '')
            === (produto.gaveta_id || '')
      )
      ||
      livres.find(
        (saldo) =>
          saldo.deposito_id
            === produto.deposito_id
      )
      ||
      livres[0];

    const depositoId =
      produto.deposito_id ||
      preferido?.deposito_id ||
      '';

    if (!depositoId) {
      continue;
    }

    const gavetaId =
      produto.gaveta_id ||
      preferido?.gaveta_id ||
      '';

    if (diff > 0) {
      let loteId = '';

      if (controlaValidade) {
        const posicaoLote =
          livres.find(
            (saldo) =>
              saldo.deposito_id
                === depositoId &&
              (saldo.gaveta_id || '')
                === (gavetaId || '') &&
              !!saldo.lote_id
          );

        loteId =
          posicaoLote?.lote_id ||
          '';

        if (!loteId) {
          throw new Error(
            `VALIDADE_OBRIGATORIA:${produto.nome}`
          );
        }
      }

      positivos.push({
        produto_id:
          produto.id,
        quantidade,
        unidade:
          produto.unidade || 'un',
        deposito_destino_id:
          depositoId,
        gaveta_destino_id:
          gavetaId,
        lote_destino_id:
          loteId || undefined,
        custo_unitario:
          Number(
            produto.custo_unitario
          ) || 0,
        observacao:
          `Ajuste de inventário — ${invLabel}`,
      });

      aplicados++;
      continue;
    }

    const alocacao =
      await construirItensSaida({
        produto,
        quantidadeBase:
          quantidade,
        depositoId,
        gavetaId,
        somenteDeposito: true,
        somenteGaveta: false,
        observacao:
          `Ajuste de inventário — ${invLabel}`,
      });

    if (!alocacao.suficiente) {
      throw new Error(
        `SALDO_INSUFICIENTE:${alocacao.totalDisponivel}:${produto.nome}`
      );
    }

    negativos.push(
      ...alocacao.itens
    );

    aplicados++;
  }

  const documentos = [];

  if (positivos.length > 0) {
    const resposta =
      await estoqueApi.movimentar({
        tipo_movimento:
          'AJUSTE_POSITIVO',
        origem_modulo:
          'inventario',
        documento_origem_id:
          `${origemBase}:positivo`,
        referencia_externa:
          invLabel || undefined,
        observacao:
          `Ajuste positivo do inventário ${invLabel}`,
        itens: positivos,
      });

    documentos.push(
      resposta.documento
    );
  }

  if (negativos.length > 0) {
    const resposta =
      await estoqueApi.movimentar({
        tipo_movimento:
          'AJUSTE_NEGATIVO',
        origem_modulo:
          'inventario',
        documento_origem_id:
          `${origemBase}:negativo`,
        referencia_externa:
          invLabel || undefined,
        observacao:
          `Ajuste negativo do inventário ${invLabel}`,
        itens: negativos,
      });

    documentos.push(
      resposta.documento
    );
  }

  invalidateEntidade(
    'SaldoEstoque'
  );
  invalidateEntidade(
    'Movimentacao'
  );
  invalidateEntidade(
    'Produto'
  );
  invalidateEntidade(
    'Lote'
  );

  return {
    aplicados,
    total:
      divergentes.length,
    documentos,
  };
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