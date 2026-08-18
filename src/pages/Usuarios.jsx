import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Users, UserPlus, Search, Trash2, ShieldCheck, Loader2, Mail, ShieldAlert,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import InviteUserDialog from '@/components/usuarios/InviteUserDialog';
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
  const [filtroRole, setFiltroRole] = useState('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [roleChange, setRoleChange] = useState({ id: '', role: '' });

  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.User.list('-created_date', 200);
      setUsuarios(data);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao carregar usuários', description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);

  const isAdmin = currentUser?.role === 'admin';

  const filtered = usuarios.filter((u) => {
    const matchBusca =
      !busca.trim() ||
      (u.full_name || '').toLowerCase().includes(busca.toLowerCase().trim()) ||
      (u.email || '').toLowerCase().includes(busca.toLowerCase().trim());
    const matchRole = filtroRole === 'all' || u.role === filtroRole;
    return matchBusca && matchRole;
  });

  const handleRoleChange = async (id, newRole) => {
    setRoleChange({ id, role: newRole });
    try {
      await base44.entities.User.update(id, { role: newRole });
      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
      toast({ title: 'Cargo atualizado', description: `Usuário agora é ${newRole === 'admin' ? 'administrador' : 'usuário'}.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar cargo', description: err?.message });
      loadUsuarios();
    } finally {
      setRoleChange({ id: '', role: '' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.User.delete(deleteTarget.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast({ title: 'Usuário removido', description: `${deleteTarget.email || 'Usuário'} foi removido do sistema.` });
      setDeleteTarget(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao remover usuário', description: err?.message });
    } finally {
      setDeleting(false);
    }
  };

  const adminCount = usuarios.filter((u) => u.role === 'admin').length;
  const userCount = usuarios.filter((u) => u.role === 'user').length;

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
          <p className="text-sm text-muted-foreground mt-1">Gerencie quem tem acesso ao sistema Novo Horizonte</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Convidar Usuário
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{usuarios.length}</p>
            <p className="text-sm text-muted-foreground">Total de Usuários</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{adminCount}</p>
            <p className="text-sm text-muted-foreground">Administradores</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{userCount}</p>
            <p className="text-sm text-muted-foreground">Usuários Comuns</p>
          </div>
        </Card>
      </div>

      {!isAdmin && (
        <Card className="p-4 flex items-start gap-3 border-amber-300 bg-amber-50">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Acesso somente leitura</p>
            <p className="text-sm text-amber-700">Apenas administradores podem convidar, alterar cargos ou remover usuários.</p>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="pl-9"
            />
          </div>
          <Select value={filtroRole} onValueChange={setFiltroRole}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cargos</SelectItem>
              <SelectItem value="admin">Administradores</SelectItem>
              <SelectItem value="user">Usuários comuns</SelectItem>
            </SelectContent>
          </Select>
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
                  <TableHead>Usuário</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                            {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{u.full_name || '—'}</p>
                            {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                      <TableCell>
                        {isAdmin && !isSelf ? (
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleRoleChange(u.id, v)}
                            disabled={roleChange.id === u.id}
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Usuário</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                            {u.role === 'admin' ? (
                              <><ShieldCheck className="w-3 h-3 mr-1" /> Administrador</>
                            ) : 'Usuário'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && !isSelf ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={loadUsuarios} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong> do sistema?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}