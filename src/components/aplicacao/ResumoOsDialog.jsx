import { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Sprout, Layers } from 'lucide-react';
import { formatQtd } from '@/lib/format';
import { parseItens } from '@/lib/osAplicacao';

// Gera um resumo das OS selecionadas: por lavoura (produtos somados) e um
// total consolidado por produto, para facilitar a separação dos insumos.
export default function ResumoOsDialog({ open, onOpenChange, ordens }) {
  const resumo = useMemo(() => {
    const porLavoura = {};
    const consolidado = {};

    for (const os of ordens || []) {
      const key = os.lavoura_id || '_sem_lavoura';
      if (!porLavoura[key]) {
        porLavoura[key] = {
          nome: os.lavoura_nome || 'Sem lavoura',
          cultura: os.cultura_nome || '',
          ano_safra: os.ano_safra || '',
          qtd_os: 0,
          produtos: {},
        };
      }
      porLavoura[key].qtd_os += 1;

      for (const it of parseItens(os.itens)) {
        const previsto = Number(it.previsto) || 0;

        if (!porLavoura[key].produtos[it.produto_id]) {
          porLavoura[key].produtos[it.produto_id] = {
            nome: it.nome,
            codigo: it.codigo,
            unidade: it.unidade || 'un',
            total: 0,
          };
        }
        porLavoura[key].produtos[it.produto_id].total += previsto;

        if (!consolidado[it.produto_id]) {
          consolidado[it.produto_id] = {
            nome: it.nome,
            codigo: it.codigo,
            unidade: it.unidade || 'un',
            total: 0,
          };
        }
        consolidado[it.produto_id].total += previsto;
      }
    }

    const lavouras = Object.values(porLavoura).map((l) => ({
      ...l,
      produtos: Object.values(l.produtos).sort((a, b) => a.nome.localeCompare(b.nome)),
    }));
    lavouras.sort((a, b) => a.nome.localeCompare(b.nome));

    return {
      lavouras,
      consolidado: Object.values(consolidado).sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  }, [ordens]);

  const totalGeral = resumo.consolidado.reduce((s, p) => s + p.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15 text-primary">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Resumo de OS Selecionadas</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {ordens?.length || 0} OS — totais previstos por lavoura e produto.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {/* Total consolidado por produto — lista para separar os insumos */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Total Consolidado por Produto</h3>
              <Badge className="bg-primary/15 text-primary border-transparent">
                {formatQtd(totalGeral)} total
              </Badge>
            </div>
            <div className="border rounded-lg overflow-x-auto scrollbar-thin">
              <table className="min-w-full w-auto text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap">Produto</th>
                    <th className="p-2 text-left whitespace-nowrap">Código</th>
                    <th className="p-2 text-center whitespace-nowrap">Un.</th>
                    <th className="p-2 text-right whitespace-nowrap">Total Previsto</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.consolidado.length === 0 ? (
                    <tr><td className="p-3 text-muted-foreground" colSpan={4}>Nenhum produto.</td></tr>
                  ) : resumo.consolidado.map((p) => (
                    <tr key={p.produto_id || p.nome} className="border-t">
                      <td className="p-2 whitespace-nowrap font-medium">{p.nome}</td>
                      <td className="p-2 whitespace-nowrap font-mono text-xs text-muted-foreground">{p.codigo}</td>
                      <td className="p-2 text-center whitespace-nowrap text-muted-foreground">{p.unidade}</td>
                      <td className="p-2 text-right whitespace-nowrap font-semibold tabular-nums">{formatQtd(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalhe por lavoura */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Por Lavoura</h3>
            </div>
            {resumo.lavouras.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma lavoura.</p>
            ) : resumo.lavouras.map((l) => (
              <div key={l.key || l.nome} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {[l.cultura, l.ano_safra].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <Badge variant="secondary">{l.qtd_os} OS</Badge>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="min-w-full w-auto text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="p-2 text-left whitespace-nowrap">Produto</th>
                        <th className="p-2 text-center whitespace-nowrap">Un.</th>
                        <th className="p-2 text-right whitespace-nowrap">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.produtos.map((p) => (
                        <tr key={p.produto_id || p.nome} className="border-t">
                          <td className="p-2 whitespace-nowrap">
                            <span className="font-medium">{p.nome}</span>
                            <span className="text-xs text-muted-foreground ml-1 font-mono">{p.codigo}</span>
                          </td>
                          <td className="p-2 text-center whitespace-nowrap text-muted-foreground">{p.unidade}</td>
                          <td className="p-2 text-right whitespace-nowrap font-semibold tabular-nums">{formatQtd(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}