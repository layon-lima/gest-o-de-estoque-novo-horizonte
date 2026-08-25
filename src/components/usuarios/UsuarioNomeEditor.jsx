import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function UsuarioNomeEditor({ user, onSaved }) {
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editando) setNome(user?.full_name || '');
  }, [editando, user?.full_name]);

  const salvar = async () => {
    const valor = nome.trim();
    if (!valor) {
      toast({ variant: 'destructive', title: 'Nome obrigatório', description: 'Informe um nome.' });
      return;
    }
    if (valor === (user?.full_name || '')) {
      setEditando(false);
      return;
    }
    setSaving(true);
    try {
      await base44.entities.User.update(user.id, { full_name: valor });
      toast({ title: 'Nome atualizado', description: `${valor} foi nomeado.` });
      onSaved?.();
      setEditando(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const cancelar = () => {
    setNome(user?.full_name || '');
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar();
            if (e.key === 'Escape') cancelar();
          }}
          placeholder="Nome do usuário"
          className="h-8"
          autoFocus
          disabled={saving}
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={salvar} disabled={saving} title="Salvar">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={cancelar} disabled={saving} title="Cancelar">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
        {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex items-center gap-2">
        <div>
          <p className="font-medium">{user?.full_name || '—'}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditando(true)} title="Editar nome">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}