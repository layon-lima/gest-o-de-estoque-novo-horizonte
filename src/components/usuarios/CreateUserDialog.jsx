import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { encodeSenha } from '@/lib/AuthContext';

export default function CreateUserDialog({ open, onOpenChange, onCreated }) {
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState('user');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setNome(''); setUsuario(''); setSenha(''); setRole('user'); setShowSenha(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome.trim() || !usuario.trim() || !senha.trim()) return;

    // Verifica se o usuário já existe
    setLoading(true);
    try {
      const existing = await base44.entities.UsuarioLocal.filter({ usuario: usuario.trim() });
      if (existing && existing.length > 0) {
        toast({ variant: 'destructive', title: 'Usuário já existe', description: `O login "${usuario.trim()}" já está em uso.` });
        setLoading(false);
        return;
      }
      await base44.entities.UsuarioLocal.create({
        nome: nome.trim(),
        usuario: usuario.trim(),
        senha: encodeSenha(senha),
        role,
        ativo: true,
      });
      toast({ title: 'Usuário criado!', description: `${nome.trim()} pode agora acessar com o login "${usuario.trim()}".` });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao criar usuário', description: err?.message || 'Não foi possível criar o usuário.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Criar Usuário
          </DialogTitle>
          <DialogDescription>
            Crie um novo usuário local. Ele poderá acessar o sistema com o usuário e senha definidos abaixo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuário (Login)</Label>
            <Input id="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="ex: joao.silva" required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Input
                id="senha"
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Defina a senha"
                required
                disabled={loading}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="master">Master (acesso total)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading || !nome.trim() || !usuario.trim() || !senha.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}