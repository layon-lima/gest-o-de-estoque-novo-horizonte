import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function NfePreviewDialog({ open, nfeInfo, items, produtos, maquinas, gavetas, onClose, onConfirm }) {
  const [edited, setEdited] = useState([]);

  useEffect(() => {
    if (items) {
      setEdited(
        items.map((item) => {
          const produto = matchNfeItem(item, produtos);
          return {
            ...item,
            produto_id: produto?.id || '',
            maquina_id: produto?.maquina_id || '',
            gaveta_id: produto?.gaveta_id || '',
            codigo_referencia: produto?.codigo_referencia || item.cProd || '',
          };
        })
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

  function handleProductChange(idx, produtoId) {
    setEdited((prev) => {
      const copy = [...prev];
      const produto = produtos.find((p) => p.id === produtoId);
      copy[idx] = {
        ...copy[idx],
        produto_id: produtoId,
        maquina_id: produto?.maquina_id || '',
        gaveta_id: produto?.gaveta_id || '',
        codigo_referencia: produto?.codigo_referencia || copy[idx].codigo_referencia || '',
      };
      return copy;
    });
  }

  const matchedCount = edited.filter((i) => i.produto_id).length;
  const canConfirm = edited.some((i) => i.produto_id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
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
                <TableHead className="w-[80px]">Qtd.</TableHead>
                <TableHead className="min-w-[200px]">Produto do Estoque</TableHead>
                <TableHead className="min-w-[160px]">Máquina</TableHead>
                <TableHead className="min-w-[140px]">Gaveta</TableHead>
                <TableHead className="min-w-[140px]">Referência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {edited.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.cProd || '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{item.xProd}</TableCell>
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
                      onValueChange={(v) => handleProductChange(idx, v === 'none' ? '' : v)}
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
                  <TableCell>
                    <Select
                      value={item.maquina_id || 'none'}
                      onValueChange={(v) => updateRow(idx, 'maquina_id', v === 'none' ? '' : v)}
                      disabled={!item.produto_id}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecionar…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhuma —</SelectItem>
                        {maquinas.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.gaveta_id || 'none'}
                      onValueChange={(v) => updateRow(idx, 'gaveta_id', v === 'none' ? '' : v)}
                      disabled={!item.produto_id}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecionar…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhuma —</SelectItem>
                        {gavetas.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      className="h-8"
                      value={item.codigo_referencia || ''}
                      onChange={(e) => updateRow(idx, 'codigo_referencia', e.target.value)}
                      disabled={!item.produto_id}
                    />
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