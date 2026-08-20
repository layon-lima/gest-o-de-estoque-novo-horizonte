import { useState, useMemo } from 'react';
import { Plus, FileSpreadsheet, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import SearchSelect from '@/components/SearchSelect';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { parseQtd, formatQtd } from '@/lib/format';
import { calcTotalKg, calcValorTotal, formatKg, formatMoeda } from '@/lib/pesagem';
import { exportPDF, exportCSV } from '@/lib/exports';

const empty = { cliente_id: '', produto_id: '', peso_saca_kg: '60', valor_saca: '0', qtd_sacas: '0', observacao: '' };

export default function PedidosManager({ pedidos, pessoas, produtos, onReload }) {
  const [form, setForm] = useState(empty);
  const { toast } = useToast();

  const clientes = pessoas.filter((p) => p.is_cliente);
  const clienteNome = (id) => pessoas.find((p) => p.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';

  const totalKg = useMemo(() => calcTotalKg(form.qtd_sacas, form.peso_saca_kg), [form.qtd_sacas, form.peso_saca_kg]);
  const valorTotal = useMemo(() => calcValorTotal(form.qtd_sacas, form.valor_saca), [form.qtd_sacas, form.valor_saca]);

  const pedidosAtivos = pedidos.filter((p) => p.status === 'aberto');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.cliente_id) {
      toast({ variant: 'destructive', title: 'Selecione um cliente' });
      return;
    }
    if (!form.produto_id) {
      toast({ variant: 'destructive', title: 'Selecione um produto' });
      return;
    }
    if (parseQtd(form.qtd_sacas) <= 0 || parseQtd(form.peso_saca_kg) <= 0) {
      toast({ variant: 'destructive', title: 'Quantidade e peso da saca devem ser maiores que zero' });
      return;
    }
    await base44.entities.PedidoPesagem.create({
      cliente_id: form.cliente_id,
      produto_id: form.produto_id,
      peso_saca_kg: parseQtd(form.peso_saca_kg),
      valor_saca: parseQtd(form.valor_saca),
      qtd_sacas: parseQtd(form.qtd_sacas),
      total_kg: totalKg,
      valor_total: valorTotal,
      saldo_kg: totalKg,
      status: 'aberto',
      observacao: form.observacao || '',
    });
    toast({ title: 'Pedido cadastrado' });
    setForm(empty);
    onReload();
  }

  function handleExportPDF() {
    const cols = ['Cliente', 'Produto', 'Sacas', 'Peso/Saca (kg)', 'Total (kg)', 'Saldo (kg)', 'Valor Saca', 'Valor Total', 'Status'];
    const rows = pedidos.map((p) => [
      clienteNome(p.cliente_id),
      produtoNome(p.produto_id),
      formatQtd(p.qtd_sacas || 0),
      formatQtd(p.peso_saca_kg || 0),
      formatQtd(p.total_kg || 0),
      formatQtd(p.saldo_kg || 0),
      formatMoeda(p.valor_saca),
      formatMoeda(p.valor_total),
      p.status,
    ]);
    exportPDF('Relatório de Pedidos de Pesagem', cols, rows);
  }
  function handleExportCSV() {
    const cols = ['Cliente', 'Produto', 'Sacas', 'Peso/Saca (kg)', 'Total (kg)', 'Saldo (kg)', 'Valor Saca', 'Valor Total', 'Status'];
    const rows = pedidos.map((p) => [
      clienteNome(p.cliente_id),
      produtoNome(p.produto_id),
      formatQtd(p.qtd_sacas || 0),
      formatQtd(p.peso_saca_kg || 0),
      formatQtd(p.total_kg || 0),
      formatQtd(p.saldo_kg || 0),
      formatMoeda(p.valor_saca),
      formatMoeda(p.valor_total),
      p.status,
    ]);
    exportCSV('Relatório de Pedidos de Pesagem', cols, rows);
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Novo Pedido</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <SearchSelect
              value={form.cliente_id}
              onChange={(v) => setForm({ ...form, cliente_id: v })}
              options={clientes.map((c) => ({ value: c.id, label: `${c.nome}${c.documento ? ' — ' + c.documento : ''}` }))}
              placeholder="Buscar cliente..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Produto *</Label>
            <SearchSelect
              value={form.produto_id}
              onChange={(v) => setForm({ ...form, produto_id: v })}
              options={produtos.filter((p) => p.venda).map((p) => ({ value: p.id, label: `${p.codigo ? p.codigo + ' — ' : ''}${p.nome}` }))}
              placeholder="Buscar produto de venda..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Peso 1 saca (kg) *</Label>
              <Input type="text" inputMode="decimal" value={form.peso_saca_kg} onChange={(e) => setForm({ ...form, peso_saca_kg: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor saca (R$)</Label>
              <Input type="text" inputMode="decimal" value={form.valor_saca} onChange={(e) => setForm({ ...form, valor_saca: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade de sacas *</Label>
            <Input type="text" inputMode="decimal" value={form.qtd_sacas} onChange={(e) => setForm({ ...form, qtd_sacas: e.target.value })} />
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total equivalente:</span><span className="font-semibold">{formatKg(totalKg)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valor total:</span><span className="font-semibold">{formatMoeda(valorTotal)}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <Button type="submit" className="w-full"><Plus className="w-4 h-4 mr-2" /> Cadastrar Pedido</Button>
        </form>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Pedidos ({pedidos.length})</h3>
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={pedidos.length === 0}><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
            <Button size="sm" onClick={handleExportCSV} disabled={pedidos.length === 0}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
          </div>
        </div>
        {pedidos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {pedidos.map((p) => {
              const pct = p.total_kg > 0 ? Math.max(0, Math.min(100, ((p.saldo_kg || 0) / p.total_kg) * 100)) : 0;
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{clienteNome(p.cliente_id)}</p>
                        <Badge variant={p.status === 'aberto' ? 'default' : 'secondary'}>{p.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{produtoNome(p.produto_id)} · {formatQtd(p.qtd_sacas || 0)} sacas · {formatMoeda(p.valor_saca)}/saca</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{formatKg(p.saldo_kg || 0)} <span className="text-muted-foreground font-normal">de {formatKg(p.total_kg || 0)}</span></p>
                      <p className="text-xs text-muted-foreground">{formatMoeda(p.valor_total)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {pedidosAtivos.length > 0 && (
          <p className="text-xs text-muted-foreground">{pedidosAtivos.length} pedido(s) aberto(s) disponíveis para fechamento de tickets.</p>
        )}
      </div>
    </div>
  );
}