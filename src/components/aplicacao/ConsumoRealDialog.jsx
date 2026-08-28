import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { formatQtd, parseQtd } from '@/lib/format';
import { parseItens, saldoProduto } from '@/lib/osAplicacao';

// Dialog para lançar o consumo real de cada produto da OS.
export default function ConsumoRealDialog({ open, onOpenChange, os, produtos, saldos, onConfirm, saving }) {
  const [itens, setItens] = useState([]);

  useEffect(() => {
    if (os && open) {
      const parsed = parseItens(os.itens).map((it) => ({
        ...it,
        realizado: it.realizado || it.previsto || 0,
      }));
      setItens(parsed);
    }
  }, [os, open]);

  function updateItem(idx, val) {
    setItens((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], realizado: val };
      return next;
    });
  }

  function handleConfirm(e) {
    e.preventDefault();
    const itensAtualizados = itens.map((it) => ({ ...it, realizado: parseQtd(it.realizado) }));
    onConfirm(itensAtualizados);
  }

  if (!os) return null;
  const parsedItens = parseItens(os.itens);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançar Consumo Real — {os.numero}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleConfirm} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Informe a quantidade real utilizada de cada produto. Ao confirmar, o estoque será baixado e a OS marcada como executada.
          </p>

          <div className="border rounded-lg overflow-x-auto scrollbar-thin">
            <table className="min-w-full w-auto text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left whitespace-nowrap">Produto</th>
                  <th className="p-2 text-right whitespace-nowrap">Previsto</th>
                  <th className="p-2 text-right whitespace-nowrap">Saldo Disp.</th>
                  <th className="p-2 text-right whitespace-nowrap">Realizado *</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const saldo = saldoProduto(it.produto_id, saldos);
                  const insuficiente = parseQtd(it.realizado) > saldo;
                  return (
                    <tr key={idx} className="border-t">
                      <td className="p-2 whitespace-nowrap">
                        <span className="font-medium">{it.nome}</span>
                        <span className="text-xs text-muted-foreground ml-1">({it.unidade})</span>
                      </td>
                      <td className="p-2 text-right whitespace-nowrap tabular-nums">{formatQtd(it.previsto)}</td>
                      <td className="p-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">{formatQtd(saldo)}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className={`h-8 w-28 text-right ${insuficiente ? 'border-destructive text-destructive' : ''}`}
                          value={it.realizado}
                          onChange={(e) => updateItem(idx, e.target.value)}
                        />
                        {insuficiente && (
                          <span className="flex items-center gap-1 text-xs text-destructive mt-0.5 justify-end">
                            <AlertTriangle className="w-3 h-3" /> Saldo insuficiente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Processando…' : 'Confirmar Consumo'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}