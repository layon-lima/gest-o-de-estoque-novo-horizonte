import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { matchNfeItem } from '@/lib/nfeParser';

export default function NfePreviewDialog({ open, nfeInfo, items, produtos, onClose, onConfirm }) {
  const [edited, setEdited] = useState([]);

  useEffect(() => {
    if (items) {
      setEdited(
        items.map((item) => ({
          ...item,
          produto_id: matchNfeItem(item, produtos)?.id || '',
        }))
      );
    }
  }, [items, produtos]);

  function updateRow(idx, field, value) {
    setEdited((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  const matchedCount = edited.filter((i) => i.produto_id).length;
  const canConfirm = edited.some((i) => i.produto_id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Confirmar Importação da NF-e</DialogTitle>
          <DialogDescription>
            Revise e corrija os itens antes de confirmar a entrada no estoque.
            {nfeInfo?.nNF && ` NF: ${nfeInfo.nNF}`}
            {nfeInfo?.emitente && ` — ${nfeInfo.emitente}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-4 h-4" /> {matchedCount} correspondente(s)
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <AlertTriangle className="w-4 h-4" /> {edited.length - matchedCount} sem match
          </span>
        </div>

        <div className="rounded-lg border overflow-auto scrollbar-thin flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-[60px]">Cód. NF</TableHead>
                <TableHead>Produto (NF-e)</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead className="w-[100px]">Qtd.</TableHead>
                <TableHead className="min-w-[220px]">Produto do Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {edited.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.cProd || '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{item.xProd}</TableCell>
                  <TableCell className="text-xs">{item.uCom || '—'}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-20"
                      value={item.qCom}
                      onChange={(e) => updateRow(idx, 'qCom', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.produto_id || 'none'}
                      onValueChange={(v) => updateRow(idx, 'produto_id', v === 'none' ? '' : v)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecionar produto…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhum —</SelectItem>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo} — {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canConfirm} onClick={() => onConfirm(edited)}>
            Confirmar Entrada ({matchedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}