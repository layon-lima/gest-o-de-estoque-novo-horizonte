import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { ClipboardList, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { formatQtd, parseQtd } from '@/lib/format';
import {
  nextInventarioNumber,
  filterProdutosParaInventario,
  qtdSistema,
  buildCriteriosDescricao,
} from '@/lib/inventario';

const emptyCriterios = { deposito_id: '', gaveta_id: '', maquina_id: '' };

export default function InventarioConference({
  open,
  onOpenChange,
  setor,
  produtos,
  depositos,
  maquinas,
  gavetas,
  lotes,
  user,
  onSaved,
}) {
  const { toast } = useToast();
  const [step, setStep] = useState('criterios');
  const [criterios, setCriterios] = useState(emptyCriterios);
  const [contagem, setContagem] = useState({});
  const [resultado, setResultado] = useState(null);
  const [saving, setSaving] = useState(false);

  const depositosSetor = useMemo(
    () => (depositos || []).filter((d) => d.setor_id === setor?.id),
    [depositos, setor]
  );

  const alvo = useMemo(
    () => filterProdutosParaInventario(produtos || [], setor?.id, criterios, lotes || []),
    [produtos, setor, criterios, lotes]
  );

  function reset() {
    setStep('criterios');
    setCriterios(emptyCriterios);
    setContagem({});
    setResultado(null);
  }

  function handleClose(open) {
    if (!open) reset();
    onOpenChange?.(open);
  }

  function iniciar() {
    setContagem({});
    setStep('conferencia');
  }

  function finalizar() {
    const itens = alvo.map((p) => {
      const sist = qtdSistema(p, lotes || []);
      const cont = parseQtd(contagem[p.id] ?? '');
      return {
        produto_id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        unidade: p.unidade || 'un',
        qtd_sistema: sist,
        qtd_contada: cont,
        divergencia: cont - sist,
        status: cont === sist ? 'acerto' : 'divergencia',
      };
    });
    const total_itens = itens.length;
    const total_acertos = itens.filter((i) => i.status === 'acerto').length;
    const total_divergencias = total_itens - total_acertos;
    setResultado({
      itens,
      total_itens,
      total_acertos,
      total_divergencias,
      resultado: total_divergencias === 0 ? 'consistente' : 'divergente',
    });
    setStep('resultado');
  }

  async function salvar() {
    setSaving(true);
    try {
      const existentes = await base44.entities.Inventario.list('-data', 500);
      await base44.entities.Inventario.create({
        numero: nextInventarioNumber(existentes),
        data: new Date().toISOString(),
        setor_id: setor.id,
        setor_nome: setor.nome,
        criterios: JSON.stringify(criterios),
        criterios_descricao: buildCriteriosDescricao(criterios, depositos, maquinas, gavetas),
        itens: JSON.stringify(resultado.itens),
        total_itens: resultado.total_itens,
        total_acertos: resultado.total_acertos,
        total_divergencias: resultado.total_divergencias,
        resultado: resultado.resultado,
        responsavel: user?.full_name || user?.email || '',
      });
      toast({
        title: 'Inventário salvo',
        description:
          resultado.resultado === 'consistente'
            ? 'Conferência sem divergências. Histórico bate.'
            : `${resultado.total_divergencias} divergência(s) registrada(s).`,
      });
      onSaved?.();
      handleClose(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Inventário — {setor?.nome}
          </DialogTitle>
        </DialogHeader>

        {step === 'criterios' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione critérios para filtrar quais produtos serão conferidos (opcional). Sem critérios, todos os produtos do setor serão listados.
              A conferência é tete-a-tete: você conta cada item e compara com o saldo do sistema.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Depósito</Label>
                <Select value={criterios.deposito_id || 'none'} onValueChange={(v) => setCriterios({ ...criterios, deposito_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Qualquer —</SelectItem>
                    {depositosSetor.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.numero}{d.nome ? ` · ${d.nome}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Gaveta</Label>
                <Select value={criterios.gaveta_id || 'none'} onValueChange={(v) => setCriterios({ ...criterios, gaveta_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a gaveta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Qualquer —</SelectItem>
                    {gavetas.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.codigo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Máquina</Label>
                <Select value={criterios.maquina_id || 'none'} onValueChange={(v) => setCriterios({ ...criterios, maquina_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a máquina" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Qualquer —</SelectItem>
                    {maquinas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={iniciar} className="w-full">Iniciar conferência</Button>
          </div>
        )}

        {step === 'conferencia' && (
          <div className="space-y-3">
            {alvo.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum produto encontrado com esses critérios.
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {alvo.length} produto(s) para conferir. Informe a quantidade contada de cada item.
                </p>
                <div className="space-y-2 max-h-[55vh] overflow-y-auto scrollbar-thin pr-1">
                  {alvo.map((p) => {
                    const sist = qtdSistema(p, lotes || []);
                    const cont = contagem[p.id] ?? '';
                    const diverge = cont !== '' && parseQtd(cont) !== sist;
                    return (
                      <Card key={p.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{p.nome}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{p.codigo}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground">Sistema</p>
                            <p className="font-semibold tabular-nums text-sm">{formatQtd(sist)} <span className="text-[10px] text-muted-foreground">{p.unidade || 'un'}</span></p>
                          </div>
                          <div className="w-28 shrink-0">
                            <Label className="text-[10px] text-muted-foreground">Contado</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="0,00"
                              value={cont}
                              onChange={(e) => setContagem({ ...contagem, [p.id]: e.target.value })}
                              className={diverge ? 'border-destructive' : ''}
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('criterios')}>Voltar</Button>
                  <Button onClick={finalizar} className="flex-1">Finalizar conferência</Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'resultado' && resultado && (
          <div className="space-y-4">
            <Card className={`p-4 ${resultado.resultado === 'consistente' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-3">
                {resultado.resultado === 'consistente' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                )}
                <div>
                  <p className="font-bold">
                    {resultado.resultado === 'consistente' ? 'Histórico bate!' : 'Divergências encontradas'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {resultado.total_acertos} de {resultado.total_itens} conferem · {resultado.total_divergencias} divergência(s)
                  </p>
                </div>
              </div>
            </Card>

            <div className="overflow-x-auto max-h-[40vh] overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Sistema</TableHead>
                    <TableHead className="text-right">Contado</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.itens.map((it) => (
                    <TableRow key={it.produto_id}>
                      <TableCell>
                        <p className="font-medium text-sm">{it.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono">{it.codigo}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatQtd(it.qtd_sistema)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatQtd(it.qtd_contada)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={it.status === 'acerto' ? 'secondary' : 'destructive'} className="tabular-nums">
                          {it.divergencia > 0 ? '+' : ''}{formatQtd(it.divergencia)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('conferencia')}>Refazer</Button>
              <Button onClick={salvar} disabled={saving} className="gap-2">
                {saving ? 'Salvando…' : (<><Save className="w-4 h-4" /> Salvar registro</>)}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}