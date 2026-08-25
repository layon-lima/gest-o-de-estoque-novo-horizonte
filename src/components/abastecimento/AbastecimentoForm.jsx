import { useState, useMemo, useRef, useEffect } from 'react';
import { Fuel, Save, ArrowLeft, AlertTriangle, Camera, Loader2, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { formatQtd, parseQtd } from '@/lib/format';

export default function AbastecimentoForm({
  maquina,
  combustiveis,
  produtoPredefinido,
  saving,
  onSubmit,
  onBack,
}) {
  const [produtoId, setProdutoId] = useState(produtoPredefinido?.id || '');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Sincroniza quando o combustível predefinido da máquina muda.
  useEffect(() => {
    if (produtoPredefinido) setProdutoId(produtoPredefinido.id);
  }, [produtoPredefinido]);

  const produto = useMemo(
    () => combustiveis.find((p) => p.id === produtoId),
    [combustiveis, produtoId]
  );

  const qtd = parseQtd(quantidade);
  const podeSalvar = produto && qtd > 0 && !saving && !uploading;

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErro('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
    } catch (err) {
      setErro('Falha ao enviar a foto. Tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (!produto) { setErro('Selecione o combustível.'); return; }
    if (!(qtd > 0)) { setErro('Informe uma quantidade maior que zero.'); return; }
    if (!fotoUrl) { setErro('Tire a foto do painel do abastecedor para confirmação.'); return; }
    try {
      await onSubmit({ produto, quantidade: qtd, observacao, foto_url: fotoUrl });
      setProdutoId(''); setQuantidade(''); setObservacao(''); setFotoUrl('');
      if (fileRef.current) fileRef.current.value = '';
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
          {produtoPredefinido ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 shadow-sm">
              <Fuel className="w-4 h-4 text-white shrink-0" />
              <span className="font-semibold text-white">{produtoPredefinido.nome}</span>
              <span className="ml-auto text-sm font-medium text-white">
                {produto ? `${formatQtd(produto.quantidade || 0)} ${produto.unidade || 'un'}` : '—'}
              </span>
            </div>
          ) : (
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
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Foto do painel do abastecedor *</Label>
          {fotoUrl ? (
            <div className="relative rounded-lg overflow-hidden border">
              <img src={fotoUrl} alt="Painel" className="w-full max-h-56 object-cover" />
              <button
                type="button"
                onClick={() => { setFotoUrl(''); if (fileRef.current) fileRef.current.value = ''; }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white bg-black/60 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" /> Foto capturada
              </div>
            </div>
          ) : (
            <label htmlFor="ab-foto" className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors text-muted-foreground">
              {uploading ? (
                <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-xs">Enviando foto…</span></>
              ) : (
                <><Camera className="w-6 h-6" /><span className="text-xs">Tirar foto do painel</span></>
              )}
            </label>
          )}
          <input
            ref={fileRef}
            id="ab-foto"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFoto}
          />
          <p className="text-xs text-muted-foreground">A foto fica anexa ao registro até um usuário autorizado confirmar a baixa.</p>
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
          O estoque não é baixado agora. Um usuário autorizado confirmará a baixa após conferir a foto.
        </p>
      </form>
    </Card>
  );
}