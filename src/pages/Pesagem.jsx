import { useState, useEffect, useCallback } from 'react';
import { Users, ClipboardList, Scale } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import ClientesManager from '@/components/pesagem/ClientesManager';
import PedidosManager from '@/components/pesagem/PedidosManager';
import TicketsManager from '@/components/pesagem/TicketsManager';

export default function Pesagem() {
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [c, p, ped, t] = await Promise.all([
      base44.entities.Cliente.list(),
      base44.entities.Produto.list(),
      base44.entities.PedidoPesagem.list('-created_date', 500),
      base44.entities.TicketPesagem.list('-data_abertura', 500),
    ]);
    setClientes(c);
    setProdutos(p);
    setPedidos(ped);
    setTickets(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const abertosCount = tickets.filter((t) => t.status === 'aberto').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Scale className="w-6 h-6 text-primary" /> Pesagem Rodoviária</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de tickets, pedidos e clientes</p>
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
            <TabsTrigger value="clientes" className="gap-1.5"><Users className="w-4 h-4" /> Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="mt-4">
            <TicketsManager tickets={tickets} pedidos={pedidos} clientes={clientes} produtos={produtos} onReload={load} />
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4">
            <PedidosManager pedidos={pedidos} clientes={clientes} produtos={produtos} onReload={load} />
          </TabsContent>
          <TabsContent value="clientes" className="mt-4">
            <ClientesManager clientes={clientes} onReload={load} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}