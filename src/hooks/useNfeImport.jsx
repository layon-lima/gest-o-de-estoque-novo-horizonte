import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { parseNfeXml } from '@/lib/nfeParser';
import { setorControlaValidade } from '@/lib/lotes';
import { findProdutoDuplicado } from '@/lib/produtoDedup';
import { convertQtyForProduto } from '@/lib/units';
import { maxNumeroMovimento, formatarNumeroMov } from '@/lib/movimentacoes';

// Gera o próximo código interno sequencial (ex.: P0001, P0002) com base
// no maior sufixo numérico encontrado entre os produtos existentes.
function proximoCodigoInterno(produtosList) {
  let max = 0;
  for (const p of produtosList) {
    const m = String(p.codigo || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `P${String(max + 1).padStart(4, '0')}`;
}

export function useNfeImport({ produtos, setores, maquinas, gavetas, onImported }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const { toast } = useToast();

  async function processFile(file) {
    if (!file) return;
    setImporting(true);
    try {
      const xmlText = await file.text();
      const { nNF, emitente, chave, items } = parseNfeXml(xmlText);

      if (items.length === 0) {
        toast({
          title: 'Nenhum item encontrado',
          description: 'O XML não contém produtos para importar.',
          variant: 'destructive',
        });
        return;
      }

      setPreview({ nNF, emitente, chave, items });
    } catch (err) {
      toast({
        title: 'Erro ao importar XML',
        description: err.message || 'Não foi possível processar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }

  async function confirm(editedItems, nfData) {
    setImporting(true);
    try {
      const numeroNf = nfData?.numero_nf ?? preview.nNF;
      const fornecedor = nfData?.fornecedor ?? preview.emitente;
      const chaveAcesso = nfData?.chave_acesso ?? preview.chave;
      const obs = `NF-e ${numeroNf}${fornecedor ? ' — ' + fornecedor : ''}`;
      const now = new Date().toISOString();

      // Bloqueia apenas se houver uma entrada ATIVA (não estornada) com a
      // mesma chave de acesso. Entradas estornadas (revertidas) permitem
      // reimportar a NF-e, restaurando o saldo no estoque.
      const chaveBusca = (chaveAcesso || '').trim();
      if (chaveBusca) {
        const existentes = await base44.entities.Movimentacao.filter({ chave_acesso: chaveBusca });
        const ativas = existentes.filter((m) => m.tipo === 'entrada' && m.estornada !== true);
        if (ativas.length > 0) {
          toast({
            title: 'NF-e já importada',
            description: 'Esta nota fiscal já está ativa no estoque. Estorne a entrada anterior para reimportá-la.',
            variant: 'destructive',
          });
          return;
        }
      }

      const lotesAtuais = await base44.entities.Lote.list();
      const movsExistentes = await base44.entities.Movimentacao.list('-created_date', 1000);
      let proxNum = maxNumeroMovimento(movsExistentes) + 1;
      const produtosWork = produtos.map((p) => ({ ...p }));
      let matched = 0;
      let unmatched = 0;
      let criados = 0;
      let convertidos = 0;

      for (const item of editedItems) {
        let produto;
        let criouNovo = false;

        if (!item.create_new && item.produto_id) {
          produto = produtosWork.find((p) => p.id === item.produto_id);
          if (!produto) { unmatched++; continue; }
        } else if (item.create_new) {
          if (!item.novo_nome || !item.novo_setor_id) { unmatched++; continue; }
          const duplicado = findProdutoDuplicado({
            produtos: produtosWork,
            dados: { codigo: item.novo_codigo || '', codigo_referencia: item.codigo_referencia || '' },
          });
          if (duplicado) {
            produto = duplicado;
          } else {
            produto = await base44.entities.Produto.create({
              nome: item.novo_nome,
              codigo: proximoCodigoInterno(produtosWork),
              setor_id: item.novo_setor_id,
              maquina_id: item.maquina_id || '',
              gaveta_id: item.gaveta_id || '',
              codigo_referencia: item.codigo_referencia || item.cProd || '',
              unidade: item.novo_unidade || 'un',
              unidade_alt: Number(item.novo_fator_conversao) > 0 ? (item.uCom || '') : '',
              fator_conversao: Number(item.novo_fator_conversao) || 0,
              quantidade: 0,
              estoque_minimo: 0,
            });
            produtosWork.push(produto);
            criouNovo = true;
            criados++;
          }
        } else {
          unmatched++;
          continue;
        }

        // Conversão de unidade: NF-e (item.uCom) -> unidade do produto.
        // Aplica-se a produtos novos E existentes. Considera conversão
        // automática (unidades mapeadas) e, se necessário, a conversão
        // customizada salva no produto ou informada na importação.
        const prodParaConv = { ...produto };
        if (!criouNovo && Number(item.fator_custom) > 0) {
          prodParaConv.unidade_alt = item.uCom;
          prodParaConv.fator_conversao = Number(item.fator_custom);
        }
        const convResult = convertQtyForProduto(item.qCom, item.uCom, prodParaConv);
        let qtd = convResult.qtd;
        if (convResult.convertido) convertidos++;

        // Persiste fator customizado informado na importação (produto existente).
        if (!criouNovo && Number(item.fator_custom) > 0) {
          await base44.entities.Produto.update(produto.id, {
            unidade_alt: item.uCom,
            fator_conversao: Number(item.fator_custom),
          });
          produto.unidade_alt = item.uCom;
          produto.fator_conversao = Number(item.fator_custom);
        }

        const controla = setorControlaValidade(produto.setor_id, setores);
        let loteId = '';
        let dataValidade = '';

        if (controla && item.codigo_lote && item.data_validade) {
          let lote = lotesAtuais.find(
            (l) => l.produto_id === produto.id && l.codigo_lote === item.codigo_lote && l.data_validade === item.data_validade
          );
          if (lote) {
            loteId = lote.id;
            lote.quantidade = (lote.quantidade || 0) + qtd;
            await base44.entities.Lote.update(lote.id, { quantidade: lote.quantidade });
          } else {
            const created = await base44.entities.Lote.create({
              produto_id: produto.id,
              setor_id: produto.setor_id,
              maquina_id: item.maquina_id || produto.maquina_id || '',
              gaveta_id: item.gaveta_id || produto.gaveta_id || '',
              codigo_lote: item.codigo_lote,
              data_validade: item.data_validade,
              quantidade: qtd,
              unidade: produto.unidade || 'un',
            });
            loteId = created.id;
            dataValidade = item.data_validade;
            lotesAtuais.push({ id: created.id, produto_id: produto.id, quantidade: qtd, data_validade: item.data_validade });
          }
          dataValidade = item.data_validade;
        }

        await base44.entities.Movimentacao.create({
          data: now,
          numero: formatarNumeroMov(proxNum++),
          produto_id: produto.id,
          codigo: produto.codigo,
          nome_produto: produto.nome,
          quantidade: qtd,
          setor_id: produto.setor_id,
          maquina_id: item.maquina_id || produto.maquina_id,
          gaveta_id: item.gaveta_id || produto.gaveta_id,
          tipo: 'entrada',
          observacao: obs,
          numero_nf: numeroNf || '',
          fornecedor: fornecedor || '',
          chave_acesso: chaveAcesso || '',
          lote_id: loteId,
          data_validade: dataValidade,
        });

        if (criouNovo && !controla) {
          await base44.entities.Produto.update(produto.id, {
            quantidade: qtd,
            maquina_id: item.maquina_id || produto.maquina_id,
            gaveta_id: item.gaveta_id || produto.gaveta_id,
            codigo_referencia: item.codigo_referencia || produto.codigo_referencia,
          });
          produto.quantidade = qtd;
        } else if (controla && loteId) {
          const lotesProduto = lotesAtuais.filter((l) => l.produto_id === produto.id);
          const novaQtd = lotesProduto.reduce((s, l) => s + (l.quantidade || 0), 0);
          await base44.entities.Produto.update(produto.id, {
            quantidade: novaQtd,
            maquina_id: item.maquina_id || produto.maquina_id,
            gaveta_id: item.gaveta_id || produto.gaveta_id,
            codigo_referencia: item.codigo_referencia || produto.codigo_referencia,
          });
          produto.quantidade = novaQtd;
        } else {
          const novaQtd = (produto.quantidade || 0) + qtd;
          await base44.entities.Produto.update(produto.id, {
            quantidade: novaQtd,
            maquina_id: item.maquina_id || produto.maquina_id,
            gaveta_id: item.gaveta_id || produto.gaveta_id,
            codigo_referencia: item.codigo_referencia || produto.codigo_referencia,
          });
          produto.quantidade = novaQtd;
        }
        matched++;
      }

      toast({
        title: 'Importação concluída',
        description: `${matched} entrada(s) registrada(s)${criados > 0 ? `, ${criados} produto(s) criado(s)` : ''}${convertidos > 0 ? `, ${convertidos} com conversão de unidade` : ''}${unmatched > 0 ? `, ${unmatched} ignorado(s)` : ''}.`,
      });

      setPreview(null);
      onImported?.();
    } catch (err) {
      toast({
        title: 'Erro ao importar',
        description: err.message || 'Não foi possível concluir a importação.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }

  function close() {
    setPreview(null);
  }

  return { importing, preview, processFile, confirm, close };
}