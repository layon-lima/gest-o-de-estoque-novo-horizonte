import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { invalidateEntidade } from '@/lib/useEntidades';

// Gerencia o cadastro de Anos Safra (pastas que agrupam as OS de aplicação).
export default function AnoSafraManager({ open, onOpenChange, anosSafra }) {
  const [novo, setNovo] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleAdd(e) {
    e.preventDefault();
    const nome = novo.trim();
    if (!nome) {
      toast({ variant: 'destructive', title: 'Informe o ano safra' });
      return;
    }
    if ((anosSafra || []).some((a) => (a.nome || '').trim() === nome)) {
      toast({ variant: 'destructive', title: 'Ano safra já cadastrado' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.AnoSafra.create({ nome });
      invalidateEntidade('AnoSafra');
      setNovo('');
      toast({ title: 'Ano safra cadastrado', description: nome });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a) {
    try {
      await base44.entities.AnoSafra.delete(a.id);
      invalidateEntidade('AnoSafra');
      toast({ title: 'Ano safra removido' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: String(err?.message || err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anos Safra</DialogTitle>
          <DialogDescription>
            Cadastre os anos safra (pastas). As OS só poderão usar os anos cadastrados aqui.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Ex.: 2025/2026"
            autoFocus
          />
          <Button type="submit" disabled={saving}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </form>

        <div className="space-y-2 max-h-64 overflow-auto scrollbar-thin">
          {(anosSafra || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum ano safra cadastrado.</p>
          ) : (
            anosSafra.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-2.5">
                <Badge variant="secondary" className="font-mono">{a.nome}</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}