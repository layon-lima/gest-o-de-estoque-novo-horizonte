import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Users, UserPlus, Search, Trash2, Loader2, ShieldCheck, UserCircle, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import CreateUserDialog from '@/components/usuarios/CreateUserDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  const isMaster = currentUser?.role === 'master';

  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.UsuarioLocal.list('-created_date', 200);
      setUsuarios(data);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao carregar usuários', description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);

  const filtered = usuarios.filter((u) => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase().trim();
    return (u.nome || '').toLowerCase().includes(t) || (u.usuario || '').toLowerCase().includes(t);
  });

  const toggleAtivo = async (u) => {
    try {
      await base44.entities.UsuarioLocal.update(u.id, { ativo: !u.ativo });
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, ativo: !u.ativo } : x)));
      toast({ title: u.ativo ? 'Usuário desativado' : 'Usuário ativado', description: u.nome });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err?.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.UsuarioLocal.delete(deleteTarget.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast({ title: 'Usuário removido', description: `${deleteTarget.nome} foi excluído do sistema.` });
      setDeleteTarget(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: err?.message });
    } finally {
      setDeleting(false);
    }
  };

  const handleResetSenha = async () => {
    if (!resetTarget || !novaSenha.trim()) return;
    setResetting(true);
    try {
      const { encodeSenha } = await import('@/lib/AuthContext');
      await base44.entities.UsuarioLocal.update(resetTarget.id, { senha: encodeSenha(novaSenha) });
      toast({ title: 'Senha redefinida!', description: `Nova senha definida para ${resetTarget.nome}.` });
      setResetTarget(null);
      setNovaSenha('');
      setShowSenha(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao redefinir senha', description: err?.message });
    } finally {
      setResetting(false);
    }
  };

  const masterCount = usuarios.filter((u) => u.role === 'master').length;
  const userCount = usuarios.filter((u) => u.role === 'user').length;
  const ativoCount = usuarios.filter((u) => u.ativo).length;

  if (loading)
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Crie usuários locais e defina suas senhas de acesso</p>
        </div>
        {isMaster && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Criar Usuário
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-2xl font-bold">{usuarios.length}</p>
            <p className="text-sm text-muted-foreground">Total de Usuários</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600"><ShieldCheck className="w-6 h-6" /></div>
          <div>
            <p className="text-2xl font-bold">{masterCount}</p>
            <p className="text-sm text-muted-foreground">Masters</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600"><UserCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-2xl font-bold">{ativoCount}</p>
            <p className="text-sm text-muted-foreground">Ativos</p>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou usuário…" className="pl-9" />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  {isMaster && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                            {(u.nome || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{u.nome}</p>
                            {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{u.usuario}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'master' ? 'default' : 'secondary'}>
                          {u.role === 'master' ? 'Master' : 'Usuário'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={!!u.ativo} onCheckedChange={() => toggleAtivo(u)} disabled={!isMaster || isSelf} />
                          <span className="text-sm">{u.ativo ? 'Ativo' : 'Inativo'}</span>
                        </div>
                      </TableCell>
                      {isMaster && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50" onClick={() => { setResetTarget(u); setNovaSenha(''); setShowSenha(false); }} title="Redefinir senha">
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            {!isSelf && (
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(u)} title="Remover usuário">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={loadUsuarios} />

      {/* Dialog de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.nome}</strong> ({deleteTarget?.usuario}) do sistema?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de redefinir senha */}
      <AlertDialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setNovaSenha(''); setShowSenha(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha</AlertDialogTitle>
            <AlertDialogDescription>
              Defina uma nova senha para <strong>{resetTarget?.nome}</strong> ({resetTarget?.usuario}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="relative">
              <Input
                type={showSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Nova senha"
                className="pr-10"
                autoFocus
              />
              <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetSenha} disabled={resetting || !novaSenha.trim()}>
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redefinir Senha'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}