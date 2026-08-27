import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import SearchSelect from '@/components/SearchSelect';
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
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useBackHandler } from '@/hooks/useBackHandler';
import { formatQtd, parseQtd } from '@/lib/format';
import { getDisplayName } from '@/lib/userName';
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
  onInventarioAberto,
}) {
  const { toast } = useToast();
  const [step, setStep] = usePersistentState(`inv:step:${setor?.id}`, 'criterios');
  const [inventarioId, setInventarioId] = usePersistentState(`inv:id:${setor?.id}`, null);
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
  const [confirmConcluir, setConfirmConcluir] = useState(false);
  const inputRef = useRef(null);

  // Voltar do sistema (mobile) caminha pelos passos na ordem inversa antes de fechar.
  useBackHandler(open && step === 'criterios', () => handleClose(false));
  useBackHandler(open && step === 'documento', () => setStep('criterios'));
  useBackHandler(open && step === 'resultado', () => setStep('documento'));
  useBackHandler(open && !!confirmConcluir, () => setConfirmConcluir(false));
  useBackHandler(open && !!aviso, () => setAviso(null));

  useEffect(() => {
    if (open && (initialInventarioId || inventarioId) && !inventario) {
      abrirDocumento(initialInventarioId || inventarioId);
    }
  }, [open, initialInventarioId, inventarioId]);

  useEffect(() => {
    if (open && step === 'criterios' && setor) {
      base44.entities.Inventario.filter({ setor_id: setor.id, status: 'aberto' })
        .then((r) => setAbertos(r))
        .catch(() => setAbertos([]));
    }
  }, [open, step, setor]);

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
    if (!ativoId) return null;
    return alvo.find((p) => p.id === ativoId) || null;
  }, [ativoId, alvo]);

  const resultadosBusca = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return [];
    return pendentes.filter((p) =>
      (p.nome || '').toLowerCase().includes(q) ||
      (p.codigo || '').toLowerCase().includes(q) ||
      (p.codigo_referencia || '').toLowerCase().includes(q)
    );
  }, [pendentes, busca]);

  const sistAtivo = produtoAtivo ? qtdSistema(produtoAtivo, lotes || []) : 0;
  const diffLive = qtdInput.trim() !== '' && produtoAtivo ? parseQtd(qtdInput) - sistAtivo : null;

  // Foco automático + limpa o campo ao trocar de produto
  useEffect(() => {
    if (step === 'documento' && produtoAtivo) {
      setQtdInput('');
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [produtoAtivo?.id, step]);

  function reset() {
    setStep('criterios');
    setInventarioId(null);
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
      setInventarioId(doc.id);
      onInventarioAberto?.(doc.id);
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
          responsavel: getDisplayName(user),
          total_itens: 0,
          total_acertos: 0,
          total_divergencias: 0,
          resultado: 'consistente',
        });
      }
      setInventario(doc);
      setInventarioId(doc.id);
      onInventarioAberto?.(doc.id);
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
        responsavel: getDisplayName(user),
        data: new Date().toISOString(),
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao registrar contagem', description: e?.message });
      return;
    }
    setAtivoId(null);
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
        responsavel: getDisplayName(user),
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
      <DialogContent className="flex flex-col gap-0 p-0 max-sm:!h-[100dvh] max-sm:!max-h-none max-sm:!max-w-none max-sm:!w-screen max-sm:!inset-0 max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!rounded-none sm:max-w-2xl sm:max-h-[92vh]">
        {/* Header fixo */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card px-4 pt-safe pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <DialogTitle className="font-semibold leading-tight truncate text-sm">
                Inventário — {setor?.nome}
              </DialogTitle>
              {inventario && (
                <span className="text-[11px] font-mono text-primary">{inventario.numero}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleClose(false)}
            className="p-2 -mr-2 rounded-md hover:bg-accent shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
          {step === 'criterios' && (
            <div className="space-y-4">
              {abertos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4" /> Documentos em aberto deste setor
                  </p>
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
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Depósito</Label>
                  <SearchSelect
                    value={criterios.deposito_id}
                    onChange={(v) => setCriterios({ ...criterios, deposito_id: v === 'all' ? '' : v })}
                    allLabel="— Qualquer —"
                    placeholder="Buscar depósito..."
                    options={depositosSetor.map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' · ' + d.nome : ''}` }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gaveta</Label>
                  <SearchSelect
                    value={criterios.gaveta_id}
                    onChange={(v) => setCriterios({ ...criterios, gaveta_id: v === 'all' ? '' : v })}
                    allLabel="— Qualquer —"
                    placeholder="Buscar gaveta..."
                    options={gavetas.map((g) => ({ value: g.id, label: g.codigo }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Máquina</Label>
                  <SearchSelect
                    value={criterios.maquina_id}
                    onChange={(v) => setCriterios({ ...criterios, maquina_id: v === 'all' ? '' : v })}
                    allLabel="— Qualquer —"
                    placeholder="Buscar máquina..."
                    options={maquinas.map((m) => ({ value: m.id, label: `${m.codigo} — ${m.nome}` }))}
                  />
                </div>
              </div>
              <Button onClick={iniciar} disabled={loadingDoc} className="w-full h-12 text-base">
                {loadingDoc ? 'Abrindo…' : 'Abrir / Criar documento'}
              </Button>
            </div>
          )}

          {step === 'documento' && inventario && (
            <div className="space-y-4">
              {total === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  Nenhum produto encontrado com esses critérios.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-end">
                    <Button variant="outline" size="sm" onClick={() => setConfirmConcluir(true)} disabled={concluindo} className="gap-1.5">
                      <Save className="w-4 h-4" /> Concluir inventário
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{conferidosCount} de {total}</span>
                      <span className="font-semibold tabular-nums">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2.5" />
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9 h-11"
                      placeholder="Buscar produto para conferir..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                  </div>

                  {busca.trim() && (
                    <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                      {resultadosBusca.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Nenhum produto pendente encontrado.</p>
                      ) : (
                        resultadosBusca.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setAtivoId(p.id); setBusca(''); }}
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

                  {produtoAtivo && (
                    <Card className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold leading-tight break-words">{produtoAtivo.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{produtoAtivo.codigo}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5">
                        <span className="text-xs text-muted-foreground">Saldo do sistema</span>
                        <span className="text-lg font-bold tabular-nums">
                          {formatQtd(sistAtivo)} <span className="text-xs font-normal text-muted-foreground">{produtoAtivo.unidade || 'un'}</span>
                        </span>
                      </div>
                    </Card>
                  )}

                  {items.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground select-none">
                        Já conferidos ({items.length})
                      </summary>
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
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

                </>
              )}
            </div>
          )}

          {step === 'resultado' && resultado && (
            <div className="space-y-4">
              <Card className={`p-4 ${resultado.resultado === 'consistente' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-3">
                  {resultado.resultado === 'consistente' ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">
                      {resultado.resultado === 'consistente' ? 'Sem divergências' : 'Com divergências'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {resultado.total_acertos} de {resultado.total_itens} conferem · {resultado.total_divergencias} diverg.
                    </p>
                  </div>
                </div>
              </Card>
              <div className="space-y-1.5">
                {resultado.itens.map((it) => (
                  <div key={it.produto_id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.nome}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{it.codigo}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">Sist. / Contado</p>
                      <p className="text-xs tabular-nums">{formatQtd(it.qtd_sistema)} → {formatQtd(it.qtd_contada)}</p>
                    </div>
                    <Badge variant={it.status === 'acerto' ? 'secondary' : 'destructive'} className="tabular-nums shrink-0">
                      {it.divergencia > 0 ? '+' : ''}{formatQtd(it.divergencia)}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button onClick={() => handleClose(false)} className="w-full h-12">Fechar</Button>
            </div>
          )}
        </div>

        {/* Barra fixa inferior (contagem) */}
        {step === 'documento' && inventario && total > 0 && produtoAtivo && (
          <div className="sticky bottom-0 z-10 border-t bg-card px-4 py-3 pb-safe space-y-2">
            <>
              <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="Qtd. contada"
                    value={qtdInput}
                    onChange={(e) => setQtdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
                    className="h-12 flex-1 text-center text-lg font-semibold"
                  />
                  <Button onClick={confirmar} className="h-12 px-6 gap-1.5">
                    <Check className="w-5 h-5" /> OK
                  </Button>
                </div>
                {diffLive !== null && (
                  <p className={`text-center text-xs font-medium ${diffLive === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {diffLive === 0
                      ? '✓ Confere com o sistema'
                      : `Diferença: ${diffLive > 0 ? '+' : ''}${formatQtd(diffLive)} ${produtoAtivo.unidade || 'un'}`}
                  </p>
                )}
            </>
          </div>
        )}

        {/* Aviso: produto já contado (bottom sheet) */}
        {aviso && (
          <div className="absolute inset-0 z-50 flex items-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setAviso(null)} />
            <div className="relative w-full bg-card rounded-t-2xl p-4 pt-3 pb-safe space-y-3">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="font-semibold">Produto já conferido</p>
              </div>
              <p className="text-sm">
                <strong className="break-words">{aviso.produto?.nome}</strong> já foi contado com{' '}
                <strong>{formatQtd(aviso.item?.qtd_contada)}</strong> {aviso.produto?.unidade || 'un'} por{' '}
                {aviso.item?.responsavel || 'outro usuário'}.
              </p>
              <Input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="Nova quantidade"
                value={aviso.qty}
                onChange={(e) => setAviso({ ...aviso, qty: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') aplicarAviso('recontar'); }}
                className="h-12 text-center text-lg font-semibold"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => aplicarAviso('add')}>Adicionar a mais</Button>
                <Button className="flex-1 h-11" onClick={() => aplicarAviso('recontar')}>Recontar</Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={confirmConcluir} onOpenChange={setConfirmConcluir}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Concluir inventário?</AlertDialogTitle>
              <AlertDialogDescription>
                {conferidosCount < total
                  ? `Você conferiu ${conferidosCount} de ${total} produtos. Os itens restantes serão registrados com o saldo do sistema. Deseja finalizar mesmo assim?`
                  : 'Todos os produtos foram conferidos. Deseja finalizar e registrar o inventário?'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={concluindo}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={concluindo} onClick={concluir}>
                {concluindo ? 'Concluindo…' : 'Sim, concluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}