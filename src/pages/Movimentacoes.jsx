import { useState, useEffect } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { getNome } from '@/lib/estoqueFilters';
import ProductSearchSelect from '@/components/ProductSearchSelect';

export default function Movimentacoes() {
  const [produtos, setProdutos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [gavetas, setGavetas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    produto_id: '',
    tipo: 'entrada',
    quantidade: 1,
    data: new Date().toISOString().slice(0, 10),
    observacao: '',
  });
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const [p, s, m, g, movs] = await Promise.all([
      base44.entities.Produto.list(),
      base44.entities.Setor.list(),
      base44.entities.Maquina.list(),
      base44.entities.Gaveta.list(),
      base44.entities.Movimentacao.list('-data', 50),
    ]);
    setProdutos(p); setSetores(s); setMaquinas(m); setGavetas(g); setMovimentacoes(movs);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const produto = produtos.find((p) => p.id === form.produto_id);
    if (!produto) return;
    setSaving(true);
    try {
      const qtd = Number(form.quantidade) || 0;
      await base44.entities.Movimentacao.create({
        data: form.data,
        produto_id: produto.id,
        codigo: produto.codigo,
        nome_produto: produto.nome,
        quantidade: qtd,
        setor_id: produto.setor_id,
        maquina_id: produto.maquina_id,
        gaveta_id: produto.gaveta_id,
        tipo: form.tipo,
        observacao: form.observacao,
      });
      const novaQtd =
        form.tipo === 'entrada'
          ? (produto.quantidade || 0) + qtd
          : Math.max(0, (produto.quantidade || 0) - qtd);
      await base44.entities.Produto.update(produto.id, { quantidade: novaQtd });
      toast({ title: 'Movimentação registrada com sucesso' });
      setForm({ produto_id: '', tipo: 'entrada', quantidade: 1, data: new Date().toISOString().slice(0, 10), observacao: '' });
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Movimentações</h1>
        <p className="text-sm text-muted-foreground mt-1">Registre entradas e saídas de estoque</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Nova Movimentação</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <ProductSearchSelect
                produtos={produtos}
                maquinas={maquinas}
                gavetas={gavetas}
                value={form.produto_id}
                onChange={(v) => setForm({ ...form, produto_id: v })}
                placeholder="Buscar produto por nome, código, referência…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mv-qtd">Quantidade *</Label>
                <Input id="mv-qtd" type="number" min="1" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mv-data">Data</Label>
              <Input id="mv-data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mv-obs">Observação</Label>
              <Textarea id="mv-obs" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !form.produto_id}>
              <Plus className="w-4 h-4 mr-2" />
              {saving ? 'Registrando…' : 'Registrar Movimentação'}
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Movimentações Recentes</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : movimentacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="rounded-lg border overflow-auto scrollbar-thin max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead>Setor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {m.data ? new Date(m.data).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{m.nome_produto || '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.codigo}</TableCell>
                        <TableCell>
                          {m.tipo === 'entrada' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                              <ArrowDownCircle className="w-3 h-3" /> Entrada
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                              <ArrowUpCircle className="w-3 h-3" /> Saída
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{m.quantidade}</TableCell>
                        <TableCell className="text-sm">{getNome(m.setor_id, setores)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}