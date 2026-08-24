import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Save,
  Search,
  Package,
  ChevronRight,
  Check,
  FolderOpen,
  Users,
} from 'lucide-react';
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

function criteriosKey(c) {
  return JSON.stringify({
    deposito_id: c.deposito_id || '',
    gaveta_id: c.gaveta_id || '',
    maquina_id: c.maquina_id || '',
  });
}

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
  initialInventarioId,
}) {
  const { toast } = useToast();
  const [step, setStep] = useState('criterios');
  const [criterios, setCriterios] = useState(emptyCriterios);
  const [inventario, setInventario] = useState(null);
  const [items, setItems] = useState([]);
  const [busca, setBusca] = useState('');
  const [ativoId, setAtivoId] = useState(null);
  const [qtdInput, setQtdInput] = useState('');
  const [abertos, setAbertos] = useState([]);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [concluindo, setConcluindo] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Retomar documento existente (resume)
  useEffect(() => {
    if (open && initialInventarioId) {
      abrirDocumento(initialInventarioId);
    }
  }, [open, initialInventarioId]);

  // Listar documentos em aberto do setor (na etapa de critérios)
  useEffect(() => {
    if (open && step === 'criterios' && setor) {
      base44.entities.Inventario.filter({ setor_id: setor.id, status: 'aberto' })
        .then((r) => setAbertos(r))
        .catch(() => setAbertos([]));
    }
  }, [open, step, setor]);

  // Carregar itens + assinar atualizações em tempo real (multiusuário)
  useEffect(() => {
    if (!inventario) return;
    let active = true;
    base44.entities.InventarioItem.filter({ inventario_id: inventario.id })
      .then((r) => { if (active) setItems(r); })
      .catch(() => {});
    const unsub = base44.entities.InventarioItem.subscribe((event) => {
      const rec = event.data;
      if (rec && rec.inventario_id !== inventario.id) return;
      setItems((prev) => {
        if (event.type === 'delete') return prev.filter((i) => i.id !== event.id);
        const exists = prev.some((i) => i.id === event.id);
        return exists ? prev.map((i) => (i.id === event.id ? rec : i)) : [...prev, rec];
      });
    });
    return () => { active = false; unsub?.(); };
  }, [inventario]);

  const criteriosDoc = useMemo(() => {
    if (inventario?.criterios) {
      try { return JSON.parse(inventario.criterios); } catch { return emptyCriterios; }
    }
    return criterios;
  }, [inventario, criterios]);

  const alvo = useMemo(
    () => filterProdutosParaInventario(produtos || [], setor?.id, criteriosDoc, lotes || []),
    [produtos, setor, criteriosDoc, lotes]
  );

  const contadosIds = useMemo(() => new Set(items.map((i) => i.produto_id)), [items]);
  const pendentes = useMemo(() => alvo.filter((p) => !contadosIds.has(p.id)), [alvo, contadosIds]);
  const conferidosCount = alvo.length - pendentes.length;
  const total = alvo.length;
  const pct = total ? Math.round((conferidosCount / total) * 100) : 0;

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
    setInventario(null);
    setItems([]);
    setBusca('');
    setAtivoId(null);
    setQtdInput('');
    setAviso(null);
    setResultado(null);
  }

  function handleClose(o) {
    if (!o) reset();
    onOpenChange?.(o);
  }

  async function abrirDocumento(id) {
    setLoadingDoc(true);
    try {
      const doc = await base44.entities.Inventario.get(id);
      setInventario(doc);
      setItems([]);
      setBusca(''); setAtivoId(null); setQtdInput(''); setAviso(null); setResultado(null);
      setStep('documento');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao abrir documento', description: e?.message });
    } finally {
      setLoadingDoc(false);
    }
  }

  async function iniciar() {
    setLoadingDoc(true);
    try {
      const key = criteriosKey(criterios);
      const abertosSetor = await base44.entities.Inventario.filter({ setor_id: setor.id, status: 'aberto' });
      const existente = abertosSetor.find((a) => (a.criterios || '') === key);
      let doc;
      if (existente) {
        doc = existente;
        toast({ title: 'Documento em aberto', description: 'Entrando no inventário já existente para este setor/critério.' });
      } else {
        const todos = await base44.entities.Inventario.list('-data', 500);
        doc = await base44.entities.Inventario.create({
          numero: nextInventarioNumber(todos),
          data: new Date().toISOString(),
          setor_id: setor.id,
          setor_nome: setor.nome,
          criterios: key,
          criterios_descricao: buildCriteriosDescricao(criterios, depositos, maquinas, gavetas),
          status: 'aberto',
          responsavel: user?.full_name || user?.email || '',
          total_itens: 0,
          total_acertos: 0,
          total_divergencias: 0,
          resultado: 'consistente',
        });
      }
      setInventario(doc);
      setItems([]);
      setBusca(''); setAtivoId(null); setQtdInput(''); setAviso(null); setResultado(null);
      setStep('documento');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao iniciar', description: e?.message });
    } finally {
      setLoadingDoc(false);
    }
  }

  async function confirmar() {
    if (!produtoAtivo || !inventario) return;
    if (qtdInput.trim() === '') {
      toast({ variant: 'destructive', title: 'Informe a quantidade', description: 'Digite a quantidade contada para confirmar.' });
      return;
    }
    const val = parseQtd(qtdInput);
    if (contadosIds.has(produtoAtivo.id)) {
      const item = items.find((i) => i.produto_id === produtoAtivo.id);
      setAviso({ item, produto: produtoAtivo, qty: '' });
      return;
    }
    try {
      await base44.entities.InventarioItem.create({
        inventario_id: inventario.id,
        produto_id: produtoAtivo.id,
        codigo: produtoAtivo.codigo,
        nome: produtoAtivo.nome,
        unidade: produtoAtivo.unidade || 'un',
        qtd_sistema: qtdSistema(produtoAtivo, lotes || []),
        qtd_contada: val,
        responsavel: user?.full_name || user?.email || '',
        data: new Date().toISOString(),
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao registrar contagem', description: e?.message });
      return;
    }
    const restantes = pendentes.filter((p) => p.id !== produtoAtivo.id);
    setAtivoId(restantes[0]?.id || null);
    setQtdInput('');
    setBusca('');
  }

  async function aplicarAviso(modo) {
    if (!aviso) return;
    if (aviso.qty.trim() === '') {
      toast({ variant: 'destructive', title: 'Informe a quantidade' });
      return;
    }
    const val = parseQtd(aviso.qty);
    const item = aviso.item;
    try {
      const nova = modo === 'add' ? (Number(item.qtd_contada) || 0) + val : val;
      await base44.entities.InventarioItem.update(item.id, {
        qtd_contada: nova,
        responsavel: user?.full_name || user?.email || '',
        data: new Date().toISOString(),
      });
      toast({ title: modo === 'add' ? 'Quantidade adicionada' : 'Quantidade recontada' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: e?.message });
    }
    setAviso(null);
    setQtdInput('');
    setBusca('');
  }

  async function concluir() {
    if (!inventario) return;
    setConcluindo(true);
    try {
      const itensDb = await base44.entities.InventarioItem.filter({ inventario_id: inventario.id });
      const contagemMap = {};
      itensDb.forEach((it) => { contagemMap[it.produto_id] = it; });
      const itens = alvo.map((p) => {
        const sist = qtdSistema(p, lotes || []);
        const it = contagemMap[p.id];
        const cont = it ? (Number(it.qtd_contada) || 0) : 0;
        return {
          produto_id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          unidade: p.unidade || 'un',
          qtd_sistema: sist,
          qtd_contada: cont,
          divergencia: cont - sist,
          status: cont === sist ? 'acerto' : 'divergencia',
          responsavel: it?.responsavel || '',
        };
      });
      const total_itens = itens.length;
      const total_acertos = itens.filter((i) => i.status === 'acerto').length;
      const total_divergencias = total_itens - total_acertos;
      const resultadoCalc = total_divergencias === 0 ? 'consistente' : 'divergente';
      await base44.entities.Inventario.update(inventario.id, {
        itens: JSON.stringify(itens),
        total_itens,
        total_acertos,
        total_divergencias,
        resultado: resultadoCalc,
        status: 'concluido',
        data_fechamento: new Date().toISOString(),
      });
      setResultado({ itens, total_itens, total_acertos, total_divergencias, resultado: resultadoCalc });
      setStep('resultado');
      onSaved?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao concluir', description: e?.message });
    } finally {
      setConcluindo(false);
    }
  }

  const depositosSetor = useMemo(
    () => (depositos || []).filter((d) => d.setor_id === setor?.id),
    [depositos, setor]
  );

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
            {abertos.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5"><FolderOpen className="w-4 h-4" /> Documentos em aberto deste setor</p>
                {abertos.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => abrirDocumento(d.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent text-left transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{d.numero}</span>
                      <p className="text-xs text-muted-foreground truncate mt-1">{d.criterios_descricao || 'Sem critérios'}</p>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">Em aberto</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
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
            <Button onClick={iniciar} disabled={loadingDoc} className="w-full">
              {loadingDoc ? 'Abrindo…' : 'Abrir / Criar documento'}
            </Button>
          </div>
        )}

        {step === 'documento' && inventario && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{inventario.numero}</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">Em aberto</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Colaborativo em tempo real</span>
            </div>

            {total === 0 ? (
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
                    <p className="text-sm text-muted-foreground">Todos os produtos foram contados. Conclua o inventário para registrar.</p>
                  </Card>
                )}

                {items.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Já conferidos ({items.length})</summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-center gap-2 p-2 rounded bg-muted/40">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{it.nome}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{it.responsavel || ''}</p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{formatQtd(it.qtd_contada)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
                  <Button onClick={concluir} disabled={concluindo} className="flex-1 gap-2">
                    {concluindo ? 'Concluindo…' : (<><Save className="w-4 h-4" /> Concluir inventário</>)}
                  </Button>
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
                    {resultado.resultado === 'consistente' ? 'Inventário concluído — sem divergências' : 'Inventário concluído — divergências'}
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
              <Button onClick={() => handleClose(false)} className="w-full">Fechar</Button>
            </DialogFooter>
          </div>
        )}

        {/* Aviso: produto já contado */}
        <Dialog open={!!aviso} onOpenChange={(o) => !o && setAviso(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" /> Produto já conferido
              </DialogTitle>
            </DialogHeader>
            {aviso && (
              <div className="space-y-3">
                <p className="text-sm">
                  <strong>{aviso.produto?.nome}</strong> já foi contado com{' '}
                  <strong>{formatQtd(aviso.item?.qtd_contada)}</strong> {aviso.produto?.unidade || 'un'} por{' '}
                  {aviso.item?.responsavel || 'outro usuário'}.
                </p>
                <p className="text-sm text-muted-foreground">O que deseja fazer?</p>
                <Input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  placeholder="Nova quantidade"
                  value={aviso.qty}
                  onChange={(e) => setAviso({ ...aviso, qty: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => aplicarAviso('add')}>Adicionar a mais</Button>
                  <Button className="flex-1" onClick={() => aplicarAviso('recontar')}>Recontar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}