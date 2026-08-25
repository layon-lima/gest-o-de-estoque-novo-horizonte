import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Users, UserPlus, Search, Loader2, ShieldCheck, UserCircle, Mail, Trash2, Fuel, Settings,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import InviteUserDialog from '@/components/usuarios/InviteUserDialog';
import PermissoesDialog from '@/components/usuarios/PermissoesDialog';
import UsuarioNomeEditor from '@/components/usuarios/UsuarioNomeEditor';
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [permTarget, setPermTarget] = useState(null);

  const isAdmin = currentUser?.role === 'admin';

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

  const filtered = usuarios.filter((u) => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase().trim();
    return (u.full_name || '').toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t);
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.User.delete(deleteTarget.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast({ title: 'Usuário removido', description: `${deleteTarget.full_name || deleteTarget.email} foi removido.` });
      setDeleteTarget(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: err?.message });
    } finally {
      setDeleting(false);
    }
  };

  const adminCount = usuarios.filter((u) => u.role === 'admin').length;
  const userCount = usuarios.filter((u) => u.role === 'user').length;
  const confirmCount = usuarios.filter((u) => u.role === 'admin' || u.pode_confirmar_abastecimento === true).length;

  const handleToggleConfirmar = async (u, value) => {
    setTogglingId(u.id);
    try {
      await base44.entities.User.update(u.id, { pode_confirmar_abastecimento: value });
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, pode_confirmar_abastecimento: value } : x)));
      toast({ title: value ? 'Permissão concedida' : 'Permissão removida', description: `${u.full_name || u.email} ${value ? 'pode confirmar abastecimentos' : 'não confirma mais abastecimentos'}.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: err?.message });
    } finally {
      setTogglingId(null);
    }
  };

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
          <p className="text-sm text-muted-foreground mt-1">Convide usuários para acessar o sistema</p>
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
          <div className="p-3 rounded-xl bg-primary/10 text-primary"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-2xl font-bold">{usuarios.length}</p>
            <p className="text-sm text-muted-foreground">Total de Usuários</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600"><ShieldCheck className="w-6 h-6" /></div>
          <div>
            <p className="text-2xl font-bold">{adminCount}</p>
            <p className="text-sm text-muted-foreground">Administradores</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600"><UserCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-2xl font-bold">{userCount}</p>
            <p className="text-sm text-muted-foreground">Usuários</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-600"><Fuel className="w-6 h-6" /></div>
          <div>
            <p className="text-2xl font-bold">{confirmCount}</p>
            <p className="text-sm text-muted-foreground">Confirmam Abastec.</p>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-9" />
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
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  {isAdmin && <TableHead>Confirma Abastec.</TableHead>}
                  {isAdmin && <TableHead>Permissões</TableHead>}
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UsuarioNomeEditor user={u} onSaved={loadUsuarios} />
                          {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          {u.email || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {u.role === 'admin' ? (
                            <span className="text-xs text-muted-foreground">Sempre (admin)</span>
                          ) : (
                            <Switch
                              checked={u.pode_confirmar_abastecimento === true}
                              disabled={togglingId === u.id}
                              onCheckedChange={(v) => handleToggleConfirmar(u, v)}
                            />
                          )}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell>
                          {u.role === 'admin' ? (
                            <span className="text-xs text-muted-foreground">Total</span>
                          ) : (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setPermTarget(u)} title="Definir permissões e setores">
                              <Settings className="w-3.5 h-3.5" /> Permissões
                            </Button>
                          )}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-right">
                          {!isSelf && (
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(u)} title="Remover usuário">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
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

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={loadUsuarios} />

      <PermissoesDialog user={permTarget} onClose={() => setPermTarget(null)} onSaved={loadUsuarios} />

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
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}