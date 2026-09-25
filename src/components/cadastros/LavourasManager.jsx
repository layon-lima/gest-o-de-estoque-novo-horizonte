import { useMemo, useState } from 'react';
import {
  MapPin,
  Pencil,
  Plus,
  Ruler,
  Search,
  Sprout,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades, invalidateEntidade } from '@/lib/useEntidades';
import { safeDelete } from '@/lib/entityOps';
import { formatQtd } from '@/lib/format';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function MiniStat({ icon: Icon, label, value, helper }) {
  return (
    <div className="flex min-h-[62px] items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-lg font-semibold leading-none">{value}</p>
          {helper ? <span className="truncate text-[9px] text-muted-foreground">{helper}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function LavourasManager() {
  const { data } = useEntidades({ Cultura: {}, Lavoura: {} });
  const culturas = data.Cultura || [];
  const lavouras = data.Lavoura || [];
  const totalHa = useMemo(() => lavouras.reduce((sum, item) => sum + (Number(item.hectares) || 0), 0), [lavouras]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <MiniStat icon={Sprout} label="Culturas" value={culturas.length} />
        <MiniStat icon={MapPin} label="Lavouras" value={lavouras.length} />
        <MiniStat icon={Ruler} label="Área cadastrada" value={formatQtd(totalHa)} helper="ha" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <CulturasPanel culturas={culturas} />
        <LavourasPanel lavouras={lavouras} />
      </div>
    </div>
  );
}

function CulturasPanel({ culturas }) {
  const [form, setForm] = useState({ nome: '' });
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return [...culturas]
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')))
      .filter((item) => !q || String(item.nome || '').toLowerCase().includes(q));
  }, [culturas, busca]);

  function resetForm() {
    setForm({ nome: '' });
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nome = form.nome.trim();
    if (!nome) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }

    try {
      if (editingId) {
        await base44.entities.Cultura.update(editingId, { nome });
        toast({ title: 'Cultura atualizada' });
      } else {
        await base44.entities.Cultura.create({ nome });
        toast({ title: 'Cultura cadastrada' });
      }
      resetForm();
      invalidateEntidade('Cultura');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar cultura', description: String(err?.message || err) });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    try {
      await safeDelete('Cultura', deleteTarget.id);
      toast({ title: 'Cultura removida' });
      if (editingId === deleteTarget.id) resetForm();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: String(err?.message || err) });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <Card className="rounded-2xl border shadow-none">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Culturas</h3>
              <p className="text-xs text-muted-foreground">Cadastro rápido usado na operação agrícola.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="cult-nome">{editingId ? 'Editar cultura' : 'Nova cultura'}</Label>
            <Input
              id="cult-nome"
              value={form.nome}
              onChange={(e) => setForm({ nome: e.target.value })}
              placeholder="Ex.: Soja"
              required
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 gap-2">
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? 'Salvar' : 'Adicionar'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </form>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cultura..." className="pl-9" />
          </div>

          <div className="max-h-[430px] space-y-1 overflow-auto pr-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma cultura encontrada.</div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${editingId === item.id ? 'bg-primary/[0.04]' : 'bg-background'}`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sprout className="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.nome}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setForm({ nome: item.nome || '' }); setEditingId(item.id); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cultura?</AlertDialogTitle>
            <AlertDialogDescription>
              A cultura <strong>{deleteTarget?.nome}</strong> será removida se não houver vínculos que impeçam a operação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LavourasPanel({ lavouras }) {
  const [form, setForm] = useState({ nome: '', numero: '', area_km2: '' });
  const [editingId, setEditingId] = useState(null);
  const [busca, setBusca] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const hectaresCalculado = (Number(String(form.area_km2).replace(',', '.')) || 0) * 100;

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return [...lavouras]
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')))
      .filter((item) => {
        if (!q) return true;
        return [item.nome, item.numero].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
      });
  }, [lavouras, busca]);

  function resetForm() {
    setForm({ nome: '', numero: '', area_km2: '' });
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      numero: form.numero,
      hectares: hectaresCalculado,
    };

    try {
      if (editingId) {
        await base44.entities.Lavoura.update(editingId, payload);
        toast({ title: 'Lavoura atualizada' });
      } else {
        await base44.entities.Lavoura.create(payload);
        toast({ title: 'Lavoura cadastrada' });
      }
      resetForm();
      invalidateEntidade('Lavoura');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar lavoura', description: String(err?.message || err) });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    try {
      await safeDelete('Lavoura', deleteTarget.id);
      toast({ title: 'Lavoura removida' });
      if (editingId === deleteTarget.id) resetForm();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: String(err?.message || err) });
    } finally {
      setDeleteTarget(null);
    }
  }

  function edit(item) {
    setForm({
      nome: item.nome || '',
      numero: item.numero || '',
      area_km2: item.hectares ? (Number(item.hectares) / 100).toString().replace('.', ',') : '',
    });
    setEditingId(item.id);
  }

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border shadow-none">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Lavouras</h3>
                <p className="text-xs text-muted-foreground">Áreas operacionais utilizadas nas ordens agrícolas.</p>
              </div>
            </div>
            {editingId ? <Badge variant="outline">Editando registro</Badge> : null}
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-muted/10 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="lav-nome">Nome *</Label>
              <Input
                id="lav-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Fazenda Santa Helena — Talhão A"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="lav-numero">Número</Label>
                <Input id="lav-numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Nº" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lav-area">Área (km²)</Label>
                <Input
                  id="lav-area"
                  inputMode="decimal"
                  value={form.area_km2}
                  onChange={(e) => setForm({ ...form, area_km2: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
              Conversão: <span className="font-semibold text-foreground">{formatQtd(hectaresCalculado)} ha</span>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 gap-2">
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? 'Salvar' : 'Adicionar'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </form>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lavoura por nome ou número..." className="pl-9" />
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma lavoura encontrada.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lavoura</TableHead>
                      <TableHead className="w-[120px]">Número</TableHead>
                      <TableHead className="w-[140px]">Área</TableHead>
                      <TableHead className="w-[110px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id} className={editingId === item.id ? 'bg-primary/[0.04]' : ''}>
                        <TableCell className="font-semibold">{item.nome}</TableCell>
                        <TableCell>{item.numero || '—'}</TableCell>
                        <TableCell>{formatQtd(item.hectares || 0)} ha</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lavoura?</AlertDialogTitle>
            <AlertDialogDescription>
              A lavoura <strong>{deleteTarget?.nome}</strong> será removida caso não existam vínculos ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
