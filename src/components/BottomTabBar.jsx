import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ArrowLeftRight,
  FileBarChart,
  Users,
  Fuel,
} from 'lucide-react';

const items = [
  { to: '/', label: 'Pesquisa', icon: LayoutDashboard, end: true },
  { to: '/movimentacoes', label: 'Mov.', icon: ArrowLeftRight, end: false },
  { to: '/abastecimento', label: 'Abast.', icon: Fuel, end: false },
  { to: '/cadastros', label: 'Cadastros', icon: Settings, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart, end: false },
];

export default function BottomTabBar() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar text-sidebar-foreground border-t border-white/10 flex items-stretch justify-around"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 py-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-sidebar-accent' : 'text-white/70'
            }`
          }
        >
          <item.icon className="w-5 h-5 shrink-0" />
          <span className="leading-none truncate max-w-full">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}