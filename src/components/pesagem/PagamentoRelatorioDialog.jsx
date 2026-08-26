import { useState, useMemo } from 'react';
import { FileSpreadsheet, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportPDF, exportCSV } from '@/lib/exports';
import { formatMoeda } from '@/lib/pesagem';

const FORMAS = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'outro', label: 'Outro' },
];

const formaLabel = (v) => FORMAS.find((f) => f.value === v)?.label || v || '—';

export default function PagamentoRelatorioDialog({ open, onClose, pagamentos, pedidos, pessoas }) {
  const [clienteId, setClienteId] = useState('todos');
  const [pedidoId, setPedidoId] = useState('todos');
  const [forma, setForma] = useState('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const pedidoNumero = (id) => pedidos.find((p) => p.id === id)?.numero || '—';

  const clientes = useMemo(() => pessoas.filter((p) => p.is_cliente), [pessoas]);
  const pedidosAtivos = useMemo(() => pedidos.filter((p) => p.status !== 'cancelado'), [pedidos]);

  const filtrados = useMemo(() => {
    return pagamentos
      .filter((p) => {
        if (clienteId !== 'todos' && p.cliente_id !== clienteId) return false;
        if (pedidoId !== 'todos' && p.pedido_id !== pedidoId) return false;
        if (forma !== 'todas' && p.forma_pagamento !== forma) return false;
        if (dataInicio && p.data_pagamento) {
          if (new Date(p.data_pagamento) < new Date(dataInicio + 'T00:00:00')) return false;
        }
        if (dataFim && p.data_pagamento) {
          if (new Date(p.data_pagamento) > new Date(dataFim + 'T23:59:59')) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.data_pagamento || 0) - new Date(a.data_pagamento || 0));
  }, [pagamentos, clienteId, pedidoId, forma, dataInicio, dataFim]);

  const total = filtrados.reduce((s, p) => s + (Number(p.valor) || 0), 0);

  function buildReport() {
    const cols = ['Número', 'Data', 'Pedido', 'Cliente', 'Forma', 'Valor (R$)', 'Observação'];
    const rows = filtrados.map((p) => [
      p.numero || '—',
      p.data_pagamento ? new Date(p.data_pagamento).toLocaleString('pt-BR') : '—',
      pedidoNumero(p.pedido_id),
      clienteNome(p.cliente_id),
      formaLabel(p.forma_pagamento),
      (Number(p.valor) || 0).toFixed(2).replace('.', ','),
      p.observacao || '',
    ]);
    rows.push(['', '', '', '', 'TOTAL', total.toFixed(2).replace('.', ','), '']);
    return { cols, rows };
  }

  function handleCSV() {
    const { cols, rows } = buildReport();
    exportCSV('Relatório de Pagamentos', cols, rows);
  }
  function handlePDF() {
    const { cols, rows } = buildReport();
    exportPDF('Relatório de Pagamentos', cols, rows);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Relatório de Pagamentos</DialogTitle>
          <DialogDescription>Defina os filtros e exporte o relatório em Excel ou PDF.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Pedido</Label>
            <Select value={pedidoId} onValueChange={setPedidoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os pedidos</SelectItem>
                {pedidosAtivos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.numero ? `${p.numero} · ` : ''}{clienteNome(p.cliente_id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Forma de Pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as formas</SelectItem>
                {FORMAS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Registros encontrados:</span><span className="font-semibold">{filtrados.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-bold text-green-600">{formatMoeda(total)}</span></div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
          <Button type="button" variant="outline" className="flex-1" onClick={handlePDF} disabled={filtrados.length === 0}><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
          <Button type="button" className="flex-1" onClick={handleCSV} disabled={filtrados.length === 0}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}