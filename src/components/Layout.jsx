import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ShieldX } from 'lucide-react';

import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';

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

  const isUsuarios =
    location.pathname === '/usuarios';

  const isBalanca =
    location.pathname === '/balanca';

  const isUsuariosAllowed =
    canAccessUsuarios(user);

  const canAccess =
    isUsuarios
      ? isUsuariosAllowed
      : isBalanca
        ? canAccessBalanca(user)
        : userCanAccess(user, pageKey);

  const allowed =
    allowedPagesForUser(user);


  useEffect(() => {
    if (!user) return;
    if (canAccess) return;

    if (allowed.length > 0) {
      navigate(
        allowed[0].path,
        { replace: true }
      );
    }
  }, [
    user,
    canAccess,
    allowed,
    navigate,
  ]);


  if (
    user
    && !canAccess
    && allowed.length === 0
  ) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 rounded-2xl bg-destructive/10 p-4 text-destructive">
          <ShieldX className="h-10 w-10" />
        </div>

        <h1 className="text-xl font-bold">
          Sem acesso
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Você não tem permissão para acessar nenhuma página.
          Contate um administrador.
        </p>
      </div>
    );
  }


  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
      />

      <header
        className="flex items-center gap-3 border-b bg-[#12362f] px-4 text-white lg:hidden"
        style={{
          paddingTop:
            'calc(0.7rem + env(safe-area-inset-top))',
          paddingBottom: '0.7rem',
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="font-bold">
          Controle de Estoque
        </span>
      </header>


      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-none scrollbar-thin pb-16 md:pb-0">
        {user && !canAccess ? (
          <div className="flex h-full items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
