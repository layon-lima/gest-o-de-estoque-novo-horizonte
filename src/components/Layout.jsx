import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ShieldX } from 'lucide-react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import BalancaStatusBadge from '@/components/balanca/BalancaStatusBadge';
import { useAuth } from '@/lib/AuthContext';
import {
  allowedPagesForUser,
  canAccessBalanca,
  canAccessUsuarios,
  pageKeyForPath,
  userCanAccess,
} from '@/lib/permissions';

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pageKey = pageKeyForPath(location.pathname);
  const isUsuarios = location.pathname === '/usuarios';
  const isBalanca = location.pathname === '/balanca';
  const isUsuariosAllowed = canAccessUsuarios(user);
  const canAccess = isUsuarios ? isUsuariosAllowed : isBalanca ? canAccessBalanca(user) : userCanAccess(user, pageKey);
  const allowed = allowedPagesForUser(user);

  useEffect(() => {
    if (!user) return;
    if (canAccess) return;
    if (allowed.length > 0) {
      navigate(allowed[0].path, { replace: true });
    }
  }, [user, canAccess, allowed, navigate]);

  if (user && !canAccess && allowed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-6">
        <div className="p-4 rounded-2xl bg-destructive/10 text-destructive mb-4">
          <ShieldX className="w-10 h-10" />
        </div>
        <h1 className="text-xl font-bold">Sem acesso</h1>
        <p className="text-sm text-muted-foreground mt-1">Você não tem permissão para acessar nenhuma página. Contate um administrador.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="lg:hidden flex items-center gap-3 px-4 glass-clear rounded-none border-x-0 border-t-0 text-foreground"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
        >
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-foreground/10">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold">Controle de Estoque Novo Horizonte</span>
          <div className="ml-auto">
            <BalancaStatusBadge />
          </div>
        </header>
        <header className="hidden lg:flex items-center justify-end gap-3 px-6 py-2 glass-clear rounded-none border-x-0 border-t-0">
          <BalancaStatusBadge />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-none scrollbar-thin pb-16 md:pb-0">
          {user && !canAccess ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <BottomTabBar />
      </div>
    </div>
  );
}