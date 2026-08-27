import { useState, useMemo } from 'react';
import { Scale, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { parseQtd } from '@/lib/format';
import { normalizePlaca, nextTicketNumber } from '@/lib/pesagem';
import LerPesoButton from '@/components/balanca/LerPesoButton';

const empty = { tipo: '', motorista: '', placa: '', peso_tara: '', produto_id: '', transportadora_id: '', origem: '', destino: '', observacao: '' };

const TIPOS = [
  { value: 'venda', label: 'Venda' },
  { value: 'lavoura', label: 'Saída Para Lavoura' },
  { value: 'compra', label: 'Entrada Por Compra' },
  { value: 'entrada_saida', label: 'Entrada e Saída' },
];

export default function AberturaTicketDialog({ open, onClose, onReload, tickets, pessoas, produtos, transportadoras }) {
  const [form, setForm] = useState(empty);
  const [step, setStep] = useState('tipo');
  const [saving, setSaving] = useState(false);
  const [sairOpen, setSairOpen] = useState(false);
  const { toast } = useToast();

  const motoristas = useMemo(() => pessoas.filter((p) => p.is_motorista), [pessoas]);

  function resetForm() { setForm(empty); setStep('tipo'); }

  function temDados() {
    return step === 'dados' && (form.motorista.trim() || form.placa.trim() || form.peso_tara.trim() || form.produto_id || form.transportadora_id || form.origem.trim() || form.destino.trim() || form.observacao.trim());
  }

  function tentarSair() {
    if (temDados()) {
      setSairOpen(true);
    } else {
      resetForm();
      onClose();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.tipo) {
      toast({ variant: 'destructive', title: 'Escolha o tipo do ticket' });
      return;
    }
    if (!form.motorista.trim() || !form.placa.trim()) {
      toast({ variant: 'destructive', title: 'Motorista e placa são obrigatórios' });
      return;
    }
    if (parseQtd(form.peso_tara) <= 0) {
      toast({ variant: 'destructive', title: 'Informe o peso tara' });
      return;
    }
    if (form.tipo !== 'venda' && !form.produto_id) {
      toast({ variant: 'destructive', title: 'Selecione o produto', description: 'Para lavoura, compra ou entrada e saída, o produto é obrigatório.' });
      return;
    }
    if (form.tipo !== 'venda' && !form.transportadora_id) {
      toast({ variant: 'destructive', title: 'Selecione a transportadora' });
      return;
    }
    const placaNorm = normalizePlaca(form.placa);
    const duplicado = tickets.some((t) => t.status === 'aberto' && normalizePlaca(t.placa) === placaNorm);
    if (duplicado) {
      toast({ variant: 'destructive', title: 'Ticket aberto para esta placa', description: 'Já existe um ticket aberto para esta placa. Feche-o antes de abrir outro.' });
      return;
    }
    setSaving(true);
    try {
      const numero = nextTicketNumber(tickets);
      const transp = transportadoras.find((t) => t.id === form.transportadora_id);
      await base44.entities.TicketPesagem.create({
        numero,
        tipo: form.tipo,
        data_abertura: new Date().toISOString(),
        motorista: form.motorista.trim(),
        placa: placaNorm,
        produto_id: form.tipo !== 'venda' ? form.produto_id || '' : '',
        transportadora_id: form.tipo !== 'venda' ? form.transportadora_id || '' : '',
        transportadora_nome: form.tipo !== 'venda' ? transp?.nome || '' : '',
        origem: form.origem.trim(),
        destino: form.tipo === 'venda' ? '' : form.destino.trim(),
        peso_tara: parseQtd(form.peso_tara),
        peso_bruto: 0,
        peso_liquido: 0,
        status: 'aberto',
        observacao: form.observacao || '',
      });
      toast({ title: 'Ticket aberto', description: numero });
      resetForm();
      onClose();
      onReload();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao abrir ticket', description: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) tentarSair(); }}>
      <DialogContent
        className="!left-0 !top-0 !translate-x-0 !translate-y-0 max-w-none h-full max-h-none rounded-none overflow-y-auto p-4 sm:p-6 content-start"
        onEscapeKeyDown={(e) => { e.preventDefault(); tentarSair(); }}
        onInteractOutside={(e) => { e.preventDefault(); tentarSair(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-primary" /> Abrir Novo Ticket</DialogTitle>
          <DialogDescription>Preencha os dados do ticket de pesagem.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-5xl mx-auto">
          {step === 'tipo' ? (
            <div className="space-y-3">
              <Label className="text-xs">Escolha o tipo de ticket *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, tipo: t.value })}
                    className={`text-left rounded-lg border p-4 transition-colors ${form.tipo === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent hover:border-primary/50'}`}
                  >
                    <span className="font-medium text-sm">{t.label}</span>
                  </button>
                ))}
              </div>
              {form.tipo === 'venda' && (
                <p className="text-xs text-muted-foreground">Na venda, o produto, o cliente e a transportadora vêm do pedido selecionado no fechamento.</p>
              )}
              <div className="flex gap-2">
                <Button type="button" className="flex-1" disabled={!form.tipo} onClick={() => setStep('dados')}>Continuar</Button>
                <Button type="button" variant="outline" onClick={tentarSair}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">Tipo: <b className="text-foreground">{TIPOS.find((t) => t.value === form.tipo)?.label}</b></span>
                <button type="button" className="text-xs text-primary underline" onClick={() => setStep('tipo')}>Alterar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Motorista *</Label>
                  <Input value={form.motorista} onChange={(e) => setForm({ ...form, motorista: e.target.value })} list="motoristas-list-dlg" placeholder="Selecione um motorista cadastrado" required />
                  <datalist id="motoristas-list-dlg">
                    {motoristas.map((m) => (
                      <option key={m.id} value={m.nome} />
                    ))}
                  </datalist>
                  {motoristas.length === 0 && (
                    <p className="text-xs text-destructive">Nenhum motorista cadastrado. Marque a flag "Motorista" em Cadastros › Pessoas.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Placa *</Label>
                  <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} placeholder="ABC1D23" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tara (kg) *</Label>
                  <div className="flex gap-2">
                    <Input type="text" inputMode="decimal" value={form.peso_tara} onChange={(e) => setForm({ ...form, peso_tara: e.target.value })} placeholder="0,00" required />
                    <LerPesoButton onPesoLido={(p) => setForm({ ...form, peso_tara: p })} />
                  </div>
                </div>
                {form.tipo !== 'venda' && (
                  <>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Produto *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={form.produto_id}
                        onChange={(e) => setForm({ ...form, produto_id: e.target.value })}
                        required
                      >
                        <option value="">Selecione...</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Transportadora *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={form.transportadora_id}
                        onChange={(e) => setForm({ ...form, transportadora_id: e.target.value })}
                        required
                      >
                        <option value="">Selecione...</option>
                        {transportadoras.map((t) => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Origem</Label>
                      <Input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} placeholder={form.tipo === 'compra' ? 'Ex.: Fornecedor' : 'Ex.: Sede'} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Destino</Label>
                      <Input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} placeholder={form.tipo === 'lavoura' ? 'Ex.: Talhão 07' : form.tipo === 'compra' ? 'Ex.: Armazém' : ''} />
                    </div>
                  </>
                )}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Observação</Label>
                  <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}><Scale className="w-4 h-4 mr-2" /> {saving ? 'Abrindo...' : 'Abrir Ticket'}</Button>
                <Button type="button" variant="outline" onClick={tentarSair}>Cancelar</Button>
              </div>
              {form.tipo === 'venda' && (
                <p className="text-xs text-muted-foreground">Na venda, o produto e o cliente vêm do pedido selecionado no fechamento.</p>
              )}
            </div>
          )}
        </form>
      </DialogContent>

      <AlertDialog open={sairOpen} onOpenChange={setSairOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem dados preenchidos que serão perdidos. Deseja fechar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar preenchendo</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setSairOpen(false); resetForm(); onClose(); }}>
              Fechar sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}