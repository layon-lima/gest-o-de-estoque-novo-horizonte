import { useState, useMemo } from 'react';
import { Fuel, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatQtd, parseQtd } from '@/lib/format';

export default function AbastecimentoForm({
  maquina,
  combustiveis,
  saving,
  onSubmit,
  onBack,
}) {
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');

  const produto = useMemo(
    () => combustiveis.find((p) => p.id === produtoId),
    [combustiveis, produtoId]
  );

  const qtd = parseQtd(quantidade);
  const saldoInsuficiente = produto && qtd > (produto.quantidade || 0);
  const podeSalvar = produto && qtd > 0 && !saldoInsuficiente && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (!produto) { setErro('Selecione o combustível.'); return; }
    if (!(qtd > 0)) { setErro('Informe uma quantidade maior que zero.'); return; }
    if (saldoInsuficiente) { setErro('Quantidade maior que o estoque disponível.'); return; }
    try {
      await onSubmit({ produto, quantidade: qtd, observacao });
      setProdutoId(''); setQuantidade(''); setObservacao('');
    } catch (err) {
      setErro(err.message || 'Erro ao registrar abastecimento.');
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Button size="icon" variant="ghost" onClick={onBack} className="-ml-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h3 className="font-semibold leading-tight">Abastecer — {maquina.nome}</h3>
          <p className="text-xs font-mono text-muted-foreground">{maquina.codigo}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mt-3">
        <div className="space-y-1.5">
          <Label>Combustível *</Label>
          <Select value={produtoId} onValueChange={(v) => { setProdutoId(v); setErro(''); }}>
            <SelectTrigger><SelectValue placeholder="Selecione o combustível" /></SelectTrigger>
            <SelectContent>
              {combustiveis.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum produto no setor de Combustíveis.
                </div>
              )}
              {combustiveis.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={(p.quantidade || 0) <= 0}>
                  {p.nome} — {formatQtd(p.quantidade || 0)} {p.unidade || 'un'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {produto && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Estoque atual:</span>
              <span className="font-semibold tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                {formatQtd(produto.quantidade || 0)} {produto.unidade || 'un'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ab-qtd">Quantidade abastecida *</Label>
          <Input
            id="ab-qtd"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className={saldoInsuficiente ? 'border-destructive' : ''}
            required
          />
          {saldoInsuficiente && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Quantidade maior que o estoque disponível ({formatQtd(produto.quantidade || 0)} {produto.unidade || 'un'}).
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ab-obs">Observação</Label>
          <Textarea id="ab-obs" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
        </div>

        {erro && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> {erro}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={!podeSalvar}>
          {saving ? <><Save className="w-4 h-4 mr-2 animate-pulse" /> Registrando…</> : <><Fuel className="w-4 h-4 mr-2" /> Registrar Abastecimento</>}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Ao salvar, o estoque do combustível é baixado automaticamente e uma saída é registrada no histórico.
        </p>
      </form>
    </Card>
  );
}