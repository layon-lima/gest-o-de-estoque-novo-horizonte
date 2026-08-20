import { useState, useEffect, useCallback } from 'react';
import { Users, ClipboardList, Scale } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import PedidosManager from '@/components/pesagem/PedidosManager';
import TicketsManager from '@/components/pesagem/TicketsManager';

export default function Pesagem() {
  const [pessoas, setPessoas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [ps, p, ped, t] = await Promise.all([
      base44.entities.Pessoa.list('-created_date', 500),
      base44.entities.Produto.list(),
      base44.entities.PedidoPesagem.list('-created_date', 500),
      base44.entities.TicketPesagem.list('-data_abertura', 500),
    ]);
    setPessoas(ps);
    setProdutos(p);
    setPedidos(ped);
    setTickets(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
          </TabsList>

          <TabsContent value="tickets" className="mt-4">
            <TicketsManager tickets={tickets} pedidos={pedidos} pessoas={pessoas} produtos={produtos} onReload={load} />
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4">
            <PedidosManager pedidos={pedidos} pessoas={pessoas} produtos={produtos} onReload={load} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}