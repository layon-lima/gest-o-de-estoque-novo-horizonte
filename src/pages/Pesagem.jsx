import { Users, ClipboardList, Scale, History, Unlink, Wallet, FileCheck2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { useEntidades } from '@/lib/useEntidades';
import PedidosManager from '@/components/pesagem/PedidosManager';
import TicketsManager from '@/components/pesagem/TicketsManager';
import PagamentosManager from '@/components/pesagem/PagamentosManager';
import NFeImportManager from '@/components/pesagem/NFeImportManager';

export default function Pesagem() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data, loading, reload: load } = useEntidades({
    Pessoa: { sort: '-created_date', limit: 500 },
    Produto: {},
    PedidoPesagem: { sort: '-created_date', limit: 500 },
    TicketPesagem: { sort: '-data_abertura', limit: 500 },
    Pagamento: { sort: '-data_pagamento', limit: 500 },
  });
  const { Pessoa: pessoas, Produto: produtos, PedidoPesagem: pedidos, TicketPesagem: tickets, Pagamento: pagamentos } = data;
  const transportadoras = pessoas.filter((p) => p.is_transportadora);

  const abertosCount = tickets.filter((t) => t.status === 'aberto').length;

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Scale className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Pesagem Rodoviária</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="tickets">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="tickets" className="gap-1.5"><Scale className="w-4 h-4" /> Tickets {abertosCount > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">{abertosCount}</span>}</TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-1.5"><ClipboardList className="w-4 h-4" /> Pedidos</TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-1.5"><Wallet className="w-4 h-4" /> Pagamentos</TabsTrigger>
            {isAdmin && <TabsTrigger value="nfe" className="gap-1.5"><FileCheck2 className="w-4 h-4" /> NF-e</TabsTrigger>}
            {isAdmin && <TabsTrigger value="naovinculados" className="gap-1.5 hidden sm:flex"><Unlink className="w-4 h-4" /> Não vinculados</TabsTrigger>}
            <TabsTrigger value="historico" className="gap-1.5"><History className="w-4 h-4" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="mt-4">
            <TicketsManager tickets={tickets} pedidos={pedidos} pessoas={pessoas} produtos={produtos} transportadoras={transportadoras} onReload={load} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4">
            <PedidosManager pedidos={pedidos} pessoas={pessoas} produtos={produtos} tickets={tickets} transportadoras={transportadoras} pagamentos={pagamentos} onReload={load} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="pagamentos" className="mt-4">
            <PagamentosManager pagamentos={pagamentos} pedidos={pedidos} pessoas={pessoas} produtos={produtos} tickets={tickets} onReload={load} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="nfe" className="mt-4">
              <NFeImportManager tickets={tickets} onReload={load} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="naovinculados" className="mt-4 hidden sm:block">
              <TicketsManager tickets={tickets} pedidos={pedidos} pessoas={pessoas} produtos={produtos} transportadoras={transportadoras} onReload={load} mode="naovinculados" isAdmin={isAdmin} />
            </TabsContent>
          )}
          <TabsContent value="historico" className="mt-4">
            <TicketsManager tickets={tickets} pedidos={pedidos} pessoas={pessoas} produtos={produtos} transportadoras={transportadoras} onReload={load} mode="historico" isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}