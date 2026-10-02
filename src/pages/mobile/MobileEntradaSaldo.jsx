import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  PackagePlus,
  Send,
} from 'lucide-react';

import { api } from '@/api/apiClient';
import { entradaSaldoMobileApi } from '@/api/entradaSaldoMobileClient';
import MobileProductPhoto from '@/components/mobile/MobileProductPhoto';
import SearchSelect from '@/components/SearchSelect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useEntidades } from '@/lib/useEntidades';
import { setoresAcessiveis } from '@/lib/setoresAcesso';

function numero(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;

  const normalizado = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;

  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function carregarImagem(file) {
  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
      img.src = url;
    });

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function recortarQuadrado(file) {
  const image = await carregarImagem(file);

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const side = Math.min(width, height);

  if (!side) {
    throw new Error('A foto selecionada é inválida.');
  }

  const output = Math.min(side, 1280);
  const canvas = document.createElement('canvas');
  canvas.width = output;
  canvas.height = output;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('O navegador não conseguiu preparar a foto.');
  }

  const sx = Math.max(0, (width - side) / 2);
  const sy = Math.max(0, (height - side) / 2);

  context.drawImage(
    image,
    sx,
    sy,
    side,
    side,
    0,
    0,
    output,
    output
  );

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9)
  );

  if (!blob) {
    throw new Error('Não foi possível recortar a foto.');
  }

  return new File(
    [blob],
    `produto-1x1-${Date.now()}.jpg`,
    { type: 'image/jpeg' }
  );
}

function StatusItem({ item }) {
  const status = item.status || 'PENDENTE';
  const aprovado = status === 'APROVADO';
  const rejeitado = status === 'REJEITADO';

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          aprovado
            ? 'bg-emerald-100 text-emerald-700'
            : rejeitado
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
        }`}
      >
        {aprovado ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Clock3 className="h-4 w-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm">{item.nome_produto}</strong>
        <span className="text-xs text-muted-foreground">
          {item.quantidade} {item.unidade || 'un'} · {status === 'PENDENTE' ? 'Aguardando revisão' : status === 'APROVADO' ? 'Aprovado' : 'Rejeitado'}
        </span>
      </div>
    </div>
  );
}

export default function MobileEntradaSaldo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const permitido =
    user?.role === 'admin'
    || user?.pode_entrada_manual_saldo_mobile === true;

  const { data, loading } = useEntidades({
    Setor: {},
    Deposito: {},
    Gaveta: {},
  });

  const setores = data.Setor || [];
  const depositos = data.Deposito || [];
  const gavetas = data.Gaveta || [];

  const [form, setForm] = useState({
    nome_produto: '',
    quantidade: '',
    setor_id: '',
    deposito_id: '',
    gaveta_id: '',
    foto_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recentes, setRecentes] = useState([]);
  const [loadingRecentes, setLoadingRecentes] = useState(false);

  const setoresPermitidos = useMemo(
    () =>
      setoresAcessiveis(setores, user)
        .slice()
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')),
    [setores, user]
  );

  const depositosDoSetor = useMemo(
    () =>
      depositos
        .filter((item) => !!form.setor_id && item.setor_id === form.setor_id)
        .slice()
        .sort((a, b) =>
          `${a.numero || ''} ${a.nome || ''}`.localeCompare(
            `${b.numero || ''} ${b.nome || ''}`,
            'pt-BR'
          )
        ),
    [depositos, form.setor_id]
  );

  const gavetasDoDeposito = useMemo(
    () =>
      gavetas
        .filter((item) => item.deposito_id === form.deposito_id)
        .slice()
        .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR')),
    [gavetas, form.deposito_id]
  );

  const gavetaObrigatoria =
    !!form.deposito_id && gavetasDoDeposito.length > 0;

  async function carregarRecentes() {
    if (!permitido) return;

    setLoadingRecentes(true);
    try {
      const itens = await entradaSaldoMobileApi.minhas();
      setRecentes((itens || []).slice(0, 4));
    } catch {
      setRecentes([]);
    } finally {
      setLoadingRecentes(false);
    }
  }

  useEffect(() => {
    carregarRecentes();
  }, [permitido]);

  function setCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
      ...(campo === 'setor_id'
        ? { deposito_id: '', gaveta_id: '' }
        : {}),
      ...(campo === 'deposito_id'
        ? { gaveta_id: '' }
        : {}),
    }));
  }

  async function enviarFoto(file) {
    if (!file) return;

    setUploading(true);

    try {
      const quadrada = await recortarQuadrado(file);
      const result = await api.integrations.Core.UploadFile({ file: quadrada });

      setForm((prev) => ({
        ...prev,
        foto_url: result.file_url,
      }));

      toast({
        title: 'Foto pronta',
        description: 'A imagem foi recortada automaticamente em 1:1.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível preparar a foto',
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  }

  async function enviar(event) {
    event.preventDefault();

    const quantidade = numero(form.quantidade);

    if (!form.nome_produto.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do produto' });
      return;
    }

    if (quantidade <= 0) {
      toast({ variant: 'destructive', title: 'Informe uma quantidade maior que zero' });
      return;
    }

    if (!form.setor_id) {
      toast({ variant: 'destructive', title: 'Selecione o setor' });
      return;
    }

    if (!form.deposito_id) {
      toast({ variant: 'destructive', title: 'Selecione o depósito' });
      return;
    }

    if (gavetaObrigatoria && !form.gaveta_id) {
      toast({
        variant: 'destructive',
        title: 'Selecione a gaveta',
        description: 'Este depósito possui gavetas vinculadas.',
      });
      return;
    }

    setSaving(true);

    try {
      await entradaSaldoMobileApi.criar({
        nome_produto: form.nome_produto.trim(),
        quantidade,
        setor_id: form.setor_id,
        deposito_id: form.deposito_id,
        gaveta_id: form.gaveta_id || null,
        foto_url: form.foto_url || null,
      });

      setForm({
        nome_produto: '',
        quantidade: '',
        setor_id: '',
        deposito_id: '',
        gaveta_id: '',
        foto_url: '',
      });

      toast({
        title: 'Enviado para revisão',
        description: 'Nenhum saldo foi alterado. Um administrador precisa aprovar no computador.',
      });

      await carregarRecentes();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível enviar',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  }

  if (!permitido) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mobile-page space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          onClick={() => navigate('/')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0">
          <span className="mobile-eyebrow">Carga inicial</span>
          <h1 className="text-xl font-bold">Entrada Manual de Saldo</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cadastre o produto no campo e envie para revisão do administrador.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border shadow-sm">
        <div className="border-b bg-primary/[0.04] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PackagePlus className="h-5 w-5" />
            </span>
            <div>
              <strong className="block text-sm">Novo saldo para revisão</strong>
              <span className="text-xs text-muted-foreground">
                O envio não altera o estoque até a aprovação no PC.
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={enviar} className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="entrada-mobile-produto">Nome do produto *</Label>
            <Input
              id="entrada-mobile-produto"
              value={form.nome_produto}
              onChange={(e) => setCampo('nome_produto', e.target.value)}
              placeholder="Ex.: Óleo Diesel B S10"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entrada-mobile-qtd">Quantidade *</Label>
            <Input
              id="entrada-mobile-qtd"
              inputMode="decimal"
              value={form.quantidade}
              onChange={(e) => setCampo('quantidade', e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Setor *</Label>
            <SearchSelect
              value={form.setor_id || 'all'}
              onChange={(value) => setCampo('setor_id', value === 'all' ? '' : value)}
              allLabel="Selecione o setor"
              placeholder="Buscar setor..."
              options={setoresPermitidos.map((item) => ({
                value: item.id,
                label: item.nome,
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Depósito *</Label>
            <SearchSelect
              value={form.deposito_id || 'all'}
              onChange={(value) => setCampo('deposito_id', value === 'all' ? '' : value)}
              allLabel={form.setor_id ? 'Selecione o depósito' : 'Selecione primeiro o setor'}
              placeholder="Buscar depósito..."
              options={depositosDoSetor.map((item) => ({
                value: item.id,
                label: `${item.numero || ''}${item.nome ? ` — ${item.nome}` : ''}`.trim(),
              }))}
            />
          </div>

          {form.deposito_id ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Gaveta {gavetaObrigatoria ? '*' : ''}</Label>
                {gavetaObrigatoria ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Obrigatória neste depósito
                  </span>
                ) : null}
              </div>

              {gavetasDoDeposito.length > 0 ? (
                <SearchSelect
                  value={form.gaveta_id || 'all'}
                  onChange={(value) => setCampo('gaveta_id', value === 'all' ? '' : value)}
                  allLabel="Selecione a gaveta"
                  placeholder="Buscar gaveta..."
                  options={gavetasDoDeposito.map((item) => ({
                    value: item.id,
                    label: `${item.codigo || ''}${item.descricao ? ` — ${item.descricao}` : ''}`,
                  }))}
                />
              ) : (
                <div className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
                  Este depósito não possui gavetas vinculadas.
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <div>
              <Label>Foto do produto</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Opcional. A foto será cortada automaticamente em 1:1 e usada no cadastro do produto.
              </p>
            </div>

            {form.foto_url ? (
              <div className="mx-auto w-full max-w-[240px]">
                <Image
                  src={form.foto_url}
                  alt="Prévia do produto"
                  className="aspect-square w-full rounded-2xl border object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-square max-h-[180px] w-full items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-muted-foreground">
                <div className="text-center">
                  <Camera className="mx-auto h-7 w-7" />
                  <span className="mt-2 block text-xs">Sem foto</span>
                </div>
              </div>
            )}

            <MobileProductPhoto
              uploading={uploading}
              onFile={enviarFoto}
            />
          </div>

          <Button
            type="submit"
            className="min-h-12 w-full gap-2 text-base"
            disabled={saving || uploading || loading}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            {saving ? 'Enviando...' : 'Enviar para revisão'}
          </Button>
        </form>
      </Card>

      <section className="space-y-2">
        <div className="mobile-section-heading mobile-section-heading--simple">
          <div>
            <span className="mobile-eyebrow">Seus envios</span>
            <p className="mobile-section-copy">Últimas Entradas Manuais de Saldo.</p>
          </div>
        </div>

        {loadingRecentes ? (
          <div className="mobile-loading-card">Carregando...</div>
        ) : recentes.length === 0 ? (
          <div className="mobile-loading-card">Nenhum envio realizado ainda.</div>
        ) : (
          <div className="space-y-2">
            {recentes.map((item) => (
              <StatusItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
