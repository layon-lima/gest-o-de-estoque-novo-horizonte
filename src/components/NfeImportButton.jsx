import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { parseNfeXml } from '@/lib/nfeParser';
import NfePreviewDialog from '@/components/NfePreviewDialog';

export default function NfeImportButton({ produtos, maquinas, gavetas, onImported }) {
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const { toast } = useToast();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const xmlText = await file.text();
      const { nNF, emitente, items } = parseNfeXml(xmlText);

      if (items.length === 0) {
        toast({
          title: 'Nenhum item encontrado',
          description: 'O XML não contém produtos para importar.',
          variant: 'destructive',
        });
        return;
      }

      setPreview({ nNF, emitente, items });
    } catch (err) {
      toast({
        title: 'Erro ao importar XML',
        description: err.message || 'Não foi possível processar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleConfirm(editedItems) {
    setImporting(true);
    try {
      const obs = `NF-e ${preview.nNF}${preview.emitente ? ' — ' + preview.emitente : ''}`;
      const now = new Date().toISOString();
      let matched = 0;
      let unmatched = 0;

      for (const item of editedItems) {
        if (!item.produto_id) {
          unmatched++;
          continue;
        }
        const produto = produtos.find((p) => p.id === item.produto_id);
        if (!produto) {
          unmatched++;
          continue;
        }

        await base44.entities.Movimentacao.create({
          data: now,
          produto_id: produto.id,
          codigo: produto.codigo,
          nome_produto: produto.nome,
          quantidade: item.qCom,
          setor_id: produto.setor_id,
          maquina_id: item.maquina_id || produto.maquina_id,
          gaveta_id: item.gaveta_id || produto.gaveta_id,
          tipo: 'entrada',
          observacao: obs,
        });

        const novaQtd = (produto.quantidade || 0) + item.qCom;
        await base44.entities.Produto.update(produto.id, {
          quantidade: novaQtd,
          maquina_id: item.maquina_id || produto.maquina_id,
          gaveta_id: item.gaveta_id || produto.gaveta_id,
          codigo_referencia: item.codigo_referencia || produto.codigo_referencia,
        });
        matched++;
      }

      toast({
        title: 'Importação concluída',
        description: `${matched} produto(s) importado(s) como entrada${unmatched > 0 ? `, ${unmatched} sem correspondência` : ''}.`,
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={importing}
        onClick={() => inputRef.current?.click()}
      >
        {importing ? (
          <>
            <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin mr-2" />
            Importando…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Importar XML (NF-e)
          </>
        )}
      </Button>

      {preview && (
        <NfePreviewDialog
          open
          nfeInfo={{ nNF: preview.nNF, emitente: preview.emitente }}
          items={preview.items}
          produtos={produtos}
          maquinas={maquinas}
          gavetas={gavetas}
          onClose={() => setPreview(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}