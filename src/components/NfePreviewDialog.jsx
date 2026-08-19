import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
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
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { UNIDADES } from '@/lib/units';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { matchNfeItem } from '@/lib/nfeParser';
import ProdutoCombobox from '@/components/ProdutoCombobox';
import { setorControlaValidade } from '@/lib/lotes';
import { sortGavetas } from '@/lib/gavetas';
import { parseQtd, formatQtd, formatQtdConvertida } from '@/lib/format';
import { normalizarUnidade } from '@/lib/units';

export default function NfePreviewDialog({ open, nfeInfo, items, produtos, setores, maquinas, gavetas, onClose, onConfirm }) {
  const [edited, setEdited] = useState([]);
  const [nfData, setNfData] = useState({ numero_nf: '', fornecedor: '', chave_acesso: '' });

  useEffect(() => {
    if (nfeInfo) {
      setNfData({
        numero_nf: nfeInfo.nNF || '',
        fornecedor: nfeInfo.emitente || '',
        chave_acesso: nfeInfo.chave || '',
      });
    }
  }, [nfeInfo]);

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
      <DialogContent className="w-screen h-screen max-w-none max-h-none left-0 top-0 translate-x-0 translate-y-0 rounded-none flex flex-col overflow-y-auto p-3 sm:p-4 gap-3">
        <DialogHeader>
          <DialogTitle>Confirmar Importação da NF-e</DialogTitle>
          <DialogDescription>
            Revise e corrija os itens antes de confirmar a entrada no estoque.
            {nfeInfo?.nNF && ` NF: ${nfeInfo.nNF}`}
            {nfeInfo?.emitente && ` — ${nfeInfo.emitente}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40 border">
          <div className="space-y-1">
            <Label className="text-xs">Número da NF</Label>
            <Input className="h-8" value={nfData.numero_nf} onChange={(e) => setNfData({ ...nfData, numero_nf: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fornecedor</Label>
            <Input className="h-8" value={nfData.fornecedor} onChange={(e) => setNfData({ ...nfData, fornecedor: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Chave de acesso</Label>
            <Input className="h-8 font-mono text-xs" value={nfData.chave_acesso} onChange={(e) => setNfData({ ...nfData, chave_acesso: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-4 h-4" /> {matchedCount} válido(s)
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <AlertTriangle className="w-4 h-4" /> {edited.length - matchedCount} ignorado(s)
          </span>
        </div>

        <div className="rounded-lg border flex-1 overflow-visible">
          <Table>
            <TableHeader className="bg-muted">
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
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-20 tabular-nums"
                          value={item.qCom}
                          onChange={(e) => updateRow(idx, 'qCom', parseQtd(e.target.value))}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{item.uCom || ''}</span>
                      </div>
                      {(() => {
                        if (item.create_new || !item.produto_id) return null;
                        const prod = produtos.find((p) => p.id === item.produto_id);
                        if (!prod?.unidade) return null;
                        const de = normalizarUnidade(item.uCom);
                        if (!de || de === prod.unidade) return null;
                        const conv = formatQtdConvertida(item.qCom, item.uCom, prod.unidade);
                        if (!conv.mudou) return null;
                        return (
                          <div className="text-[11px] text-primary font-medium mt-1 whitespace-nowrap">
                            ≈ {conv.texto}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <ProdutoCombobox
                        value={selectValue(item)}
                        onChange={(v) => handleSelectChange(idx, v)}
                        produtos={produtos}
                      />
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
                              <SelectTrigger className="h-8 w-[200px]">
                                <SelectValue placeholder="Selecionar…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Nenhum —</SelectItem>
                                {setores.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unidade</Label>
                            <Select
                              value={item.novo_unidade || 'un'}
                              onValueChange={(v) => updateRow(idx, 'novo_unidade', v)}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIDADES.map((fam, fi) => (
                                  <SelectGroup key={fam.familia}>
                                    {fi > 0 && <SelectSeparator />}
                                    <SelectLabel>{fam.familia}</SelectLabel>
                                    {fam.itens.map((u) => (
                                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
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
          <Button disabled={!canConfirm} onClick={() => onConfirm(edited, nfData)}>
            Confirmar Entrada ({matchedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}