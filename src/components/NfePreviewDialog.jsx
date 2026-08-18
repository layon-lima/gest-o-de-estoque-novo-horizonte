import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { setorControlaValidade } from '@/lib/lotes';
import { sortGavetas } from '@/lib/gavetas';

export default function NfePreviewDialog({ open, nfeInfo, items, produtos, setores, maquinas, gavetas, onClose, onConfirm }) {
  const [edited, setEdited] = useState([]);

  useEffect(() => {
    if (items) {
      setEdited(
        items.map((item) => {
          const produto = matchNfeItem(item, produtos);
          const matched = !!produto;
          return {
            ...item,
            produto_id: produto?.id || '',
            create_new: !matched,
            novo_nome: item.xProd || '',
            novo_codigo: item.cProd || '',
            novo_setor_id: '',
            novo_unidade: item.uCom || 'un',
            maquina_id: produto?.maquina_id || '',
            gaveta_id: produto?.gaveta_id || '',
            codigo_referencia: produto?.codigo_referencia || item.cProd || '',
            codigo_lote: '',
            data_validade: '',
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

  function handleSelectChange(idx, value) {
    setEdited((prev) => {
      const copy = [...prev];
      if (value === 'new') {
        copy[idx] = { ...copy[idx], produto_id: '', create_new: true };
      } else if (value === 'none') {
        copy[idx] = { ...copy[idx], produto_id: '', create_new: false };
      } else {
        const produto = produtos.find((p) => p.id === value);
        copy[idx] = {
          ...copy[idx],
          produto_id: value,
          create_new: false,
          maquina_id: produto?.maquina_id || '',
          gaveta_id: produto?.gaveta_id || '',
          codigo_referencia: produto?.codigo_referencia || copy[idx].codigo_referencia || '',
        };
      }
      return copy;
    });
  }

  function itemControlaValidade(item) {
    const setorId = item.create_new
      ? item.novo_setor_id
      : produtos.find((p) => p.id === item.produto_id)?.setor_id;
    return setorControlaValidade(setorId, setores);
  }

  function isItemValid(item) {
    const hasProduto = item.produto_id || (item.create_new && item.novo_nome && item.novo_setor_id);
    if (!hasProduto) return false;
    if (itemControlaValidade(item)) return !!(item.codigo_lote && item.data_validade);
    return true;
  }

  const matchedCount = edited.filter(isItemValid).length;
  const canConfirm = edited.some(isItemValid);

  function selectValue(item) {
    if (item.create_new) return 'new';
    if (item.produto_id) return item.produto_id;
    return 'none';
  }

  const editable = (item) => item.produto_id || item.create_new;

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
            <CheckCircle2 className="w-4 h-4" /> {matchedCount} válido(s)
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <AlertTriangle className="w-4 h-4" /> {edited.length - matchedCount} ignorado(s)
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
                <>
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
                        value={selectValue(item)}
                        onValueChange={(v) => handleSelectChange(idx, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Selecionar produto…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Nenhum —</SelectItem>
                          <SelectItem value="new">
                            <span className="flex items-center gap-1 text-primary">
                              <PlusCircle className="w-3.5 h-3.5" /> Criar novo produto
                            </span>
                          </SelectItem>
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
                        disabled={!editable(item)}
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
                        disabled={!editable(item)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Selecionar…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Nenhuma —</SelectItem>
                          {sortGavetas(gavetas).map((g) => (
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
                        disabled={!editable(item)}
                      />
                    </TableCell>
                  </TableRow>
                  {item.create_new && (
                    <TableRow key={`${idx}-new`} className="bg-accent/40">
                      <TableCell colSpan={7} className="py-3">
                        <div className="flex items-end gap-3 flex-wrap">
                          <div className="space-y-1">
                            <Label className="text-xs">Nome *</Label>
                            <Input
                              className="h-8 w-[220px]"
                              value={item.novo_nome || ''}
                              onChange={(e) => updateRow(idx, 'novo_nome', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Código Interno</Label>
                            <Input
                              className="h-8 w-[140px]"
                              value={item.novo_codigo || ''}
                              onChange={(e) => updateRow(idx, 'novo_codigo', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Setor *</Label>
                            <Select
                              value={item.novo_setor_id || 'none'}
                              onValueChange={(v) => updateRow(idx, 'novo_setor_id', v === 'none' ? '' : v)}
                            >
                              <SelectTrigger className="h-8 w-[180px]">
                                <SelectValue placeholder="Selecionar…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Selecionar —</SelectItem>
                                {setores.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unidade</Label>
                            <Input
                              className="h-8 w-[80px]"
                              value={item.novo_unidade || ''}
                              onChange={(e) => updateRow(idx, 'novo_unidade', e.target.value)}
                            />
                          </div>
                          {itemControlaValidade(item) && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-xs">Lote *</Label>
                                <Input className="h-8 w-[140px]" value={item.codigo_lote || ''} onChange={(e) => updateRow(idx, 'codigo_lote', e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Validade *</Label>
                                <Input type="date" className="h-8 w-[150px]" value={item.data_validade || ''} onChange={(e) => updateRow(idx, 'data_validade', e.target.value)} />
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!item.create_new && item.produto_id && itemControlaValidade(item) && (
                    <TableRow key={`${idx}-lote`} className="bg-amber-50/50">
                      <TableCell colSpan={7} className="py-2">
                        <div className="flex items-end gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Lote *</Label>
                            <Input className="h-8 w-[160px]" value={item.codigo_lote || ''} onChange={(e) => updateRow(idx, 'codigo_lote', e.target.value)} placeholder="Código do lote" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Validade *</Label>
                            <Input type="date" className="h-8 w-[160px]" value={item.data_validade || ''} onChange={(e) => updateRow(idx, 'data_validade', e.target.value)} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
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