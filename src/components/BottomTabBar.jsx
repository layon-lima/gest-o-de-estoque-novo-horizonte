import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ArrowLeftRight,
  FileBarChart,
  Fuel,
  Scale,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { allowedPagesForUser } from '@/lib/permissions';
import SetorIcon from '@/components/setorIcon';

const allItems = [
  { key: 'dashboard', to: '/', label: 'Pesquisa', icon: LayoutDashboard, end: true },
  { key: 'movimentacoes', to: '/movimentacoes', label: 'Mov.', icon: ArrowLeftRight, end: false },
  { key: 'abastecimento', to: '/abastecimento', label: 'Abast.', icon: Fuel, end: false },
  { key: 'pesagem', to: '/pesagem', label: 'Pesagem', icon: Scale, end: false },
  { key: 'cadastros', to: '/cadastros', label: 'Cadastros', icon: Settings, end: false },
  { key: 'relatorios', to: '/relatorios', label: 'Relatórios', icon: FileBarChart, end: false },
];

function abreviar(nome) {
  const n = (nome || '').trim();
  if (n.length <= 6) return n;
  return n.slice(0, 6) + '…';
}

export default function BottomTabBar() {
  const { user } = useAuth();
  const [setores, setSetores] = useState([]);

  const allowedKeys = new Set(allowedPagesForUser(user).map((p) => p.key));
  const items = allItems.filter((it) => allowedKeys.has(it.key));

  useEffect(() => {
    base44.entities.Setor.list()
      .then((s) => setSetores(s))
      .catch(() => setSetores([]));
  }, []);

  const setoresVisiveis = setores
    .filter((s) => s.tem_aba_mobile === true)
    .filter((s) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      const permitidos = Array.isArray(user.setores_permitidos) ? user.setores_permitidos : [];
      return permitidos.includes(s.id);
    });

  if (items.length === 0 && setoresVisiveis.length === 0) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar text-sidebar-foreground border-t border-white/10 flex items-stretch justify-around overflow-x-auto scrollbar-thin"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 py-2 text-[10px] font-medium transition-colors min-w-[52px] ${
              isActive ? 'text-sidebar-accent' : 'text-white/70'
            }`
          }
        >
          <item.icon className="w-5 h-5 shrink-0" />
          <span className="leading-none truncate max-w-full">{item.label}</span>
        </NavLink>
      ))}
      {setoresVisiveis.map((s) => (
        <NavLink
          key={s.id}
          to={`/setor/${s.id}`}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 py-2 text-[10px] font-medium transition-colors min-w-[52px] ${
              isActive ? 'text-sidebar-accent' : 'text-white/70'
            }`
          }
        >
          <SetorIcon setor={s} className="w-5 h-5 shrink-0" />
          <span className="leading-none truncate max-w-full">{abreviar(s.nome)}</span>
        </NavLink>
      ))}
    </nav>
  );
}