import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Settings,
  ArrowLeftRight,
  FileBarChart,
  Users,
  Leaf,
  X,
  LogOut,
  Boxes,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { to: '/', label: 'Pesquisa', icon: LayoutDashboard, end: true },
  { to: '/movimentacoes', label: 'Entradas e Saídas', icon: ArrowLeftRight, end: false },
  { to: '/produtos', label: 'Produtos', icon: Package, end: false },
  { to: '/lotes', label: 'Lotes e Validade', icon: Boxes, end: false },
  { to: '/cadastros', label: 'Cadastros', icon: Settings, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart, end: false },
  { to: '/usuarios', label: 'Usuários', icon: Users, end: false },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transform transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15">
              <Leaf className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Gestão Estoque</h1>
              <p className="text-xs opacity-70 font-medium">Novo Horizonte</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-white/10">
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
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center font-semibold text-sm shrink-0">
              {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.full_name || 'Usuário'}</p>
              <p className="text-xs text-white/60 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors">
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}