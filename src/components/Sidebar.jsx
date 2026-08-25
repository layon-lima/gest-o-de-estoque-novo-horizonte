import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ArrowLeftRight,
  FileBarChart,
  ClipboardList,
  Leaf,
  Fuel,
  Scale,
  X,
  LogOut,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { getDisplayName, getDisplayInitial } from '@/lib/userName';
import { allowedPagesForUser } from '@/lib/permissions';
import { setoresAcessiveis } from '@/lib/setoresAcesso';
import { base44 } from '@/api/base44Client';
import SetorIcon from '@/components/setorIcon';
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

const allNavItems = [
  { key: 'dashboard', to: '/', label: 'Pesquisa', icon: LayoutDashboard, end: true },
  { key: 'movimentacoes', to: '/movimentacoes', label: 'Entradas e Saídas', icon: ArrowLeftRight, end: false },
  { key: 'abastecimento', to: '/abastecimento', label: 'Abastecimento', icon: Fuel, end: false },
  { key: 'pesagem', to: '/pesagem', label: 'Pesagem', icon: Scale, end: false },
  { key: 'cadastros', to: '/cadastros', label: 'Cadastros', icon: Settings, end: false },
  { key: 'relatorios', to: '/relatorios', label: 'Relatórios', icon: FileBarChart, end: false },
  { key: 'inventario', to: '/inventario', label: 'Inventário', icon: ClipboardList, end: false },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [setores, setSetores] = useState([]);

  useEffect(() => {
    base44.entities.Setor.list().then(setSetores).catch(() => setSetores([]));
  }, []);

  const allowedKeys = new Set(allowedPagesForUser(user).map((p) => p.key));
  const navItems = allNavItems.filter((it) => allowedKeys.has(it.key));
  const setoresUser = setoresAcessiveis(setores, user);

  const handleDeleteAccount = async () => {
    setDeleteOpen(false);
    toast({
      title: 'Exclusão de conta solicitada',
      description:
        'Entre em contato com o administrador para concluir a exclusão dos seus dados.',
    });
    await logout();
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-clear text-foreground flex flex-col transform transition-transform duration-300 lg:m-3 lg:rounded-3xl ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15 text-primary">
              <Leaf className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Controle de Estoque</h1>
              <p className="text-xs opacity-70 font-medium">Novo Horizonte</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-foreground/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/70 hover:bg-foreground/10 hover:text-foreground'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {setoresUser.length > 0 && (
            <div className="pt-2 mt-2 border-t border-foreground/10">
             <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-foreground/50 font-semibold">Setores</p>
             {setoresUser.map((s) => (
               <NavLink
                 key={s.id}
                 to={`/setor/${s.id}`}
                 onClick={onClose}
                 className={({ isActive }) =>
                   `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                     isActive
                       ? 'bg-primary text-primary-foreground shadow-sm'
                       : 'text-foreground/70 hover:bg-foreground/10 hover:text-foreground'
                   }`
                 }
               >
                  <SetorIcon setor={s} className="w-5 h-5 shrink-0" />
                  {s.nome}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-foreground/10 space-y-2">
          <div className="flex items-center gap-3 px-2 pb-1">
            <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
              {getDisplayInitial(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{getDisplayName(user) || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 hover:bg-foreground/10 hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Excluir Conta
          </button>
        </div>
      </aside>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação removerá seus dados e encerrará sua sessão.
              Esta operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAccount}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}