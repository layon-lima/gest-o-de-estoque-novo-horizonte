import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-sidebar text-sidebar-foreground">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold">Gestão Estoque Novo Horizonte</span>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}