import { useState, useMemo } from 'react';
import { Plus, FileSpreadsheet, FileDown, Search, Scale, CircleDot, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { parseQtd, formatQtd } from '@/lib/format';
import { normalizePlaca, formatPlaca, nextTicketNumber, formatKg } from '@/lib/pesagem';
import { exportPDF, exportCSV } from '@/lib/exports';
import FechamentoTicketDialog from './FechamentoTicketDialog';

const empty = { motorista: '', placa: '', peso_tara: '', observacao: '' };

export default function TicketsManager({ tickets, pedidos, clientes, produtos, onReload }) {
  const [form, setForm] = useState(empty);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [fecharTicket, setFecharTicket] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const clienteNome = (id) => clientes.find((c) => c.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';
  const pedidoDoTicket = (id) => pedidos.find((p) => p.id === id);

  const abertos = useMemo(
    () => tickets.filter((t) => t.status === 'aberto').sort((a, b) => new Date(b.data_abertura) - new Date(a.data_abertura)),
    [tickets]
  );

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return tickets
      .filter((t) => filtroStatus === 'all' || t.status === filtroStatus)
      .filter((t) => {
        if (!q) return true;
        const ped = pedidoDoTicket(t.pedido_id);
        return [t.numero, t.motorista, t.placa, ped ? clienteNome(ped.cliente_id) : ''].filter(Boolean).join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.data_abertura) - new Date(a.data_abertura));
  }, [tickets, busca, filtroStatus]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.motorista.trim() || !form.placa.trim()) {
      toast({ variant: 'destructive', title: 'Motorista e placa são obrigatórios' });
      return;
    }
    if (parseQtd(form.peso_tara) <= 0) {
      toast({ variant: 'destructive', title: 'Informe o peso tara' });
      return;
    }
    const placaNorm = normalizePlaca(form.placa);
    const duplicado = abertos.some((t) => normalizePlaca(t.placa) === placaNorm);
    if (duplicado) {
      toast({ variant: 'destructive', title: 'Ticket aberto para esta placa', description: 'Já existe um ticket aberto (sem peso bruto) para esta placa. Feche-o antes de abrir outro.' });
      return;
    }
    setSaving(true);
    try {
      const numero = nextTicketNumber(tickets);
      await base44.entities.TicketPesagem.create({
        numero,
        data_abertura: new Date().toISOString(),
        motorista: form.motorista.trim(),
        placa: placaNorm,
        peso_tara: parseQtd(form.peso_tara),
        peso_bruto: 0,
        peso_liquido: 0,
        status: 'aberto',
        observacao: form.observacao || '',
      });
      toast({ title: 'Ticket aberto', description: numero });
      setForm(empty);
      onReload();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao abrir ticket', description: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  }

  function handleExportPDF() {
    const cols = ['Ticket', 'Abertura', 'Fechamento', 'Motorista', 'Placa', 'Tara (kg)', 'Bruto (kg)', 'Líquido (kg)', 'Cliente', 'Produto', 'Status'];
    const rows = filtrados.map((t) => {
      const ped = pedidoDoTicket(t.pedido_id);
      return [
        t.numero,
        t.data_abertura ? new Date(t.data_abertura).toLocaleString('pt-BR') : '',
        t.data_fechamento ? new Date(t.data_fechamento).toLocaleString('pt-BR') : '',
        t.motorista || '',
        formatPlaca(t.placa),
        formatQtd(t.peso_tara || 0),
        formatQtd(t.peso_bruto || 0),
        formatQtd(t.peso_liquido || 0),
        ped ? clienteNome(ped.cliente_id) : '',
        ped ? produtoNome(ped.produto_id) : '',
        t.status,
      ];
    });
    exportPDF('Relatório de Tickets de Pesagem', cols, rows);
  }
  function handleExportCSV() {
    const cols = ['Ticket', 'Abertura', 'Fechamento', 'Motorista', 'Placa', 'Tara (kg)', 'Bruto (kg)', 'Líquido (kg)', 'Cliente', 'Produto', 'Status'];
    const rows = filtrados.map((t) => {
      const ped = pedidoDoTicket(t.pedido_id);
      return [
        t.numero,
        t.data_abertura ? new Date(t.data_abertura).toLocaleString('pt-BR') : '',
        t.data_fechamento ? new Date(t.data_fechamento).toLocaleString('pt-BR') : '',
        t.motorista || '',
        formatPlaca(t.placa),
        formatQtd(t.peso_tara || 0),
        formatQtd(t.peso_bruto || 0),
        formatQtd(t.peso_liquido || 0),
        ped ? clienteNome(ped.cliente_id) : '',
        ped ? produtoNome(ped.produto_id) : '',
        t.status,
      ];
    });
    exportCSV('Relatório de Tickets de Pesagem', cols, rows);
  }

  return (
    <div className="space-y-6">
      {/* Form de abertura rápida */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Abrir Ticket (1ª Pesagem)</h3>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-4 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Motorista *</Label>
            <Input value={form.motorista} onChange={(e) => setForm({ ...form, motorista: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Placa *</Label>
            <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} placeholder="ABC-1234" required />
          </div>
          <div className="space-y-1.5">
            <Label>Peso Tara (kg) *</Label>
            <Input type="text" inputMode="decimal" value={form.peso_tara} onChange={(e) => setForm({ ...form, peso_tara: e.target.value })} placeholder="0,00" required />
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={saving}><Scale className="w-4 h-4 mr-2" /> {saving ? 'Abrindo...' : 'Abrir Ticket'}</Button>
          </div>
        </form>
      </Card>

      {/* Tickets abertos em destaque */}
      {abertos.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><CircleDot className="w-4 h-4 text-amber-500" /> Tickets Abertos ({abertos.length})</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {abertos.map((t) => (
              <Card key={t.id} className="p-4 border-amber-300 bg-amber-50/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-sm">{t.numero}</p>
                    <p className="text-sm font-medium truncate">{t.motorista}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatPlaca(t.placa)}</p>
                  </div>
                  <Badge className="bg-amber-500 hover:bg-amber-500">Aberto</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tara: <span className="font-semibold text-foreground">{formatKg(t.peso_tara)}</span></span>
                  <span className="text-xs text-muted-foreground">{t.data_abertura ? new Date(t.data_abertura).toLocaleString('pt-BR') : ''}</span>
                </div>
                <Button className="w-full mt-3" onClick={() => setFecharTicket(t)}>Fechar Pesagem</Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Todos os tickets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por ticket, placa, motorista..." className="pl-9" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              {[
                { v: 'all', l: 'Todos' },
                { v: 'aberto', l: 'Abertos' },
                { v: 'fechado', l: 'Fechados' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFiltroStatus(opt.v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${filtroStatus === opt.v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filtrados.length === 0}><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
            <Button size="sm" onClick={handleExportCSV} disabled={filtrados.length === 0}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum ticket encontrado.</p>
        ) : (
          <div className="rounded-lg border overflow-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Ticket</th>
                  <th className="text-left p-2 font-medium">Abertura</th>
                  <th className="text-left p-2 font-medium">Motorista</th>
                  <th className="text-left p-2 font-medium">Placa</th>
                  <th className="text-right p-2 font-medium">Tara</th>
                  <th className="text-right p-2 font-medium">Bruto</th>
                  <th className="text-right p-2 font-medium">Líquido</th>
                  <th className="text-left p-2 font-medium">Cliente</th>
                  <th className="text-center p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => {
                  const ped = pedidoDoTicket(t.pedido_id);
                  return (
                    <tr key={t.id} className="border-t hover:bg-muted/40">
                      <td className="p-2 font-mono text-xs">{t.numero}</td>
                      <td className="p-2 text-xs whitespace-nowrap">{t.data_abertura ? new Date(t.data_abertura).toLocaleString('pt-BR') : '—'}</td>
                      <td className="p-2">{t.motorista}</td>
                      <td className="p-2 font-mono">{formatPlaca(t.placa)}</td>
                      <td className="p-2 text-right">{formatQtd(t.peso_tara || 0)}</td>
                      <td className="p-2 text-right">{t.peso_bruto ? formatQtd(t.peso_bruto) : '—'}</td>
                      <td className="p-2 text-right font-semibold">{t.peso_liquido ? formatQtd(t.peso_liquido) : '—'}</td>
                      <td className="p-2 text-xs">{ped ? clienteNome(ped.cliente_id) : '—'}</td>
                      <td className="p-2 text-center">
                        {t.status === 'aberto' ? (
                          <Badge className="bg-amber-500 hover:bg-amber-500">Aberto</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Fechado</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FechamentoTicketDialog
        ticket={fecharTicket}
        pedidos={pedidos}
        clientes={clientes}
        produtos={produtos}
        open={!!fecharTicket}
        onClose={() => setFecharTicket(null)}
        onClosed={() => { setFecharTicket(null); onReload(); }}
      />
    </div>
  );
}