import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { PAGES } from '@/lib/permissions';

export default function PermissoesDialog({ user, onClose, onSaved }) {
  const open = !!user;
  const [selecionados, setSelecionados] = useState([]);
  const [setores, setSetores] = useState([]);
  const [setoresSel, setSetoresSel] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSelecionados(Array.isArray(user?.paginas_permitidas) ? user.paginas_permitidas : []);
    setSetoresSel(Array.isArray(user?.setores_permitidos) ? user.setores_permitidos : []);
  }, [user]);

  useEffect(() => {
    if (open) {
      base44.entities.Setor.list().then((s) => setSetores(s.filter((x) => x.tem_aba_mobile === true))).catch(() => setSetores([]));
    }
  }, [open]);

  const toggle = (key) => {
    setSelecionados((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleSetor = (id) => {
    setSetoresSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.User.update(user.id, { paginas_permitidas: selecionados, setores_permitidos: setoresSel });
      toast({ title: 'Permissões atualizadas', description: `${user.full_name || user.email} teve o acesso redefinido.` });
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err?.message || 'Não foi possível atualizar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Permissões de Acesso</DialogTitle>
          <DialogDescription>Defina quais abas <b>{user?.full_name || user?.email}</b> pode acessar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {PAGES.map((p) => (
            <label key={p.key} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
              <Checkbox checked={selecionados.includes(p.key)} onCheckedChange={() => toggle(p.key)} />
              <span className="text-sm font-medium">{p.label}</span>
            </label>
          ))}
        </div>
        {setores.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-semibold">Setores liberados (mobile)</p>
            <p className="text-xs text-muted-foreground -mt-1">Quais setores este usuário pode usar — cada um vira um ícone na barra inferior.</p>
            {setores.map((s) => (
              <label key={s.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                <Checkbox checked={setoresSel.includes(s.id)} onCheckedChange={() => toggleSetor(s.id)} />
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.cor || '#16a34a' }} />
                <span className="text-sm font-medium">{s.nome}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Usuários só verão e poderão acessar as abas marcadas. Administradores têm acesso total.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Permissões'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}