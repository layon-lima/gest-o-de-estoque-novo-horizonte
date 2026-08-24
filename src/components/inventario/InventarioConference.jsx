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
import { ClipboardList, CheckCircle2, AlertTriangle, Save, Search, Package, ChevronRight, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
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
  const [busca, setBusca] = useState('');
  const [ativoId, setAtivoId] = useState(null);
  const [qtdInput, setQtdInput] = useState('');

  const depositosSetor = useMemo(
    () => (depositos || []).filter((d) => d.setor_id === setor?.id),
    [depositos, setor]
  );

  const alvo = useMemo(
    () => filterProdutosParaInventario(produtos || [], setor?.id, criterios, lotes || []),
    [produtos, setor, criterios, lotes]
  );

  const conferidosCount = alvo.filter((p) => contagem[p.id] !== undefined).length;
  const total = alvo.length;
  const pct = total ? Math.round((conferidosCount / total) * 100) : 0;
  const pendentes = alvo.filter((p) => contagem[p.id] === undefined);

  const produtoAtivo = useMemo(() => {
    if (ativoId) {
      const f = alvo.find((p) => p.id === ativoId);
      if (f) return f;
    }
    return pendentes[0] || null;
  }, [ativoId, alvo, pendentes]);

  const resultadosBusca = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return [];
    return pendentes.filter((p) =>
      (p.nome || '').toLowerCase().includes(q) ||
      (p.codigo || '').toLowerCase().includes(q) ||
      (p.codigo_referencia || '').toLowerCase().includes(q)
    );
  }, [pendentes, busca]);

  function reset() {
    setStep('criterios');
    setCriterios(emptyCriterios);
    setContagem({});
    setResultado(null);
    setBusca('');
    setAtivoId(null);
    setQtdInput('');
  }

  function handleClose(open) {
    if (!open) reset();
    onOpenChange?.(open);
  }

  function iniciar() {
    setContagem({});
    setBusca('');
    setAtivoId(null);
    setQtdInput('');
    setStep('conferencia');
  }

  function confirmar() {
    if (!produtoAtivo) return;
    if (qtdInput.trim() === '') {
      toast({ variant: 'destructive', title: 'Informe a quantidade', description: 'Digite a quantidade contada para confirmar.' });
      return;
    }
    const val = parseQtd(qtdInput);
    setContagem({ ...contagem, [produtoAtivo.id]: val });
    const restantes = pendentes.filter((p) => p.id !== produtoAtivo.id);
    setAtivoId(restantes[0]?.id || null);
    setQtdInput('');
    setBusca('');
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
          <div className="space-y-4">
            {alvo.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum produto encontrado com esses critérios.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{conferidosCount} de {total} conferidos</span>
                    <span className="font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2.5" />
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar produto para conferir..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>

                {busca.trim() && (
                  <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                    {resultadosBusca.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhum produto pendente encontrado.</p>
                    ) : (
                      resultadosBusca.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setAtivoId(p.id); setBusca(''); setQtdInput(''); }}
                          className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent text-left transition-colors"
                        >
                          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.nome}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{p.codigo}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                )}

                {produtoAtivo ? (
                  <Card className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{produtoAtivo.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{produtoAtivo.codigo}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">Sistema</p>
                        <p className="font-semibold tabular-nums">{formatQtd(qtdSistema(produtoAtivo, lotes || []))} <span className="text-[10px] text-muted-foreground">{produtoAtivo.unidade || 'un'}</span></p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Quantidade contada</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        placeholder="0,00"
                        value={qtdInput}
                        onChange={(e) => setQtdInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
                      />
                    </div>
                    <Button onClick={confirmar} className="w-full gap-2">
                      <Check className="w-4 h-4" /> Confirmar e avançar
                    </Button>
                  </Card>
                ) : (
                  <Card className="p-6 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="font-medium">Tudo conferido!</p>
                    <p className="text-sm text-muted-foreground">Todos os produtos foram contados. Finalize a conferência.</p>
                  </Card>
                )}

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