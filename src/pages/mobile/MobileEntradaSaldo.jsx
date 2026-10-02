import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';

import { api } from '@/api/apiClient';
import { entradaSaldoMobileApi } from '@/api/entradaSaldoMobileClient';
import MobileProductPhoto from '@/components/mobile/MobileProductPhoto';
import SearchSelect from '@/components/SearchSelect';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function InlineNotice({ notice }) {
  if (!notice) return null;

  const tone = notice.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : notice.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  const Icon = notice.type === 'error'
    ? AlertCircle
    : notice.type === 'success'
      ? CheckCircle2
      : Loader2;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${tone}`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          notice.type === 'info' ? 'animate-spin' : ''
        }`}
      />
      <div className="min-w-0">
        <strong className="block text-sm leading-5">{notice.title}</strong>
        {notice.description ? (
          <span className="mt-0.5 block text-xs leading-5 opacity-80">
            {notice.description}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatusItem({ item }) {
  const status = item.status || 'PENDENTE';
  const aprovado = status === 'APROVADO';
  const rejeitado = status === 'REJEITADO';

  const Icon = aprovado
    ? CheckCircle2
    : rejeitado
      ? XCircle
      : Clock3;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-background px-3 py-2.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          aprovado
            ? 'bg-emerald-100 text-emerald-700'
            : rejeitado
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold">
          {item.nome_produto}
        </strong>
        <span className="block truncate text-[11px] text-muted-foreground">
          {item.quantidade} {item.unidade || 'un'} · {
            status === 'PENDENTE'
              ? 'Aguardando revisão'
              : status === 'APROVADO'
                ? 'Aprovado'
                : 'Rejeitado'
          }
        </span>
      </div>
    </div>
  );
}

export default function MobileEntradaSaldo() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const [notice, setNotice] = useState(null);
  const [recentes, setRecentes] = useState([]);
  const [loadingRecentes, setLoadingRecentes] = useState(false);

  const setoresPermitidos = useMemo(
    () =>
      setoresAcessiveis(setores, user)
        .slice()
        .sort((a, b) =>
          String(a.nome || '').localeCompare(
            String(b.nome || ''),
            'pt-BR'
          )
        ),
    [setores, user]
  );

  const depositosDoSetor = useMemo(
    () =>
      depositos
        .filter(
          (item) =>
            !!form.setor_id
            && item.setor_id === form.setor_id
        )
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
        .filter(
          (item) =>
            item.deposito_id === form.deposito_id
        )
        .slice()
        .sort((a, b) =>
          String(a.codigo || '').localeCompare(
            String(b.codigo || ''),
            'pt-BR'
          )
        ),
    [gavetas, form.deposito_id]
  );

  const gavetaObrigatoria =
    !!form.deposito_id
    && gavetasDoDeposito.length > 0;

  async function carregarRecentes() {
    if (!permitido) return;

    setLoadingRecentes(true);

    try {
      const itens = await entradaSaldoMobileApi.minhas();
      setRecentes((itens || []).slice(0, 3));
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
    setNotice(null);

    setForm((prev) => ({
      ...prev,
      [campo]: valor,
      ...(campo === 'setor_id'
        ? {
            deposito_id: '',
            gaveta_id: '',
          }
        : {}),
      ...(campo === 'deposito_id'
        ? {
            gaveta_id: '',
          }
        : {}),
    }));
  }

  function erro(title, description = '') {
    setNotice({
      type: 'error',
      title,
      description,
    });
  }

  async function enviarFoto(file) {
    if (!file) return;

    setUploading(true);
    setNotice({
      type: 'info',
      title: 'Preparando foto...',
      description: 'A imagem será ajustada automaticamente para 1:1.',
    });

    try {
      const quadrada = await recortarQuadrado(file);
      const result = await api.integrations.Core.UploadFile({
        file: quadrada,
      });

      setForm((prev) => ({
        ...prev,
        foto_url: result.file_url,
      }));

      setNotice(null);
    } catch (error) {
      erro(
        'Não foi possível usar esta foto',
        error.message
      );
    } finally {
      setUploading(false);
    }
  }

  async function enviar(event) {
    event.preventDefault();

    const quantidade = numero(form.quantidade);

    if (!form.nome_produto.trim()) {
      erro('Informe o nome do produto.');
      return;
    }

    if (quantidade <= 0) {
      erro('Informe uma quantidade maior que zero.');
      return;
    }

    if (!form.setor_id) {
      erro('Selecione o setor.');
      return;
    }

    if (!form.deposito_id) {
      erro('Selecione o depósito.');
      return;
    }

    if (gavetaObrigatoria && !form.gaveta_id) {
      erro(
        'Selecione a gaveta.',
        'Este depósito possui gavetas vinculadas.'
      );
      return;
    }

    setSaving(true);
    setNotice({
      type: 'info',
      title: 'Enviando para revisão...',
    });

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

      setNotice({
        type: 'success',
        title: 'Enviado para revisão.',
        description: 'O estoque só será alterado depois da aprovação no computador.',
      });

      await carregarRecentes();
    } catch (error) {
      erro(
        'Não foi possível enviar.',
        error.message
      );
    } finally {
      setSaving(false);
    }
  }

  if (!permitido) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mobile-page pb-6">
      <header className="mb-3 flex items-center gap-3">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-background"
          onClick={() => navigate('/')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">
            Entrada Manual de Saldo
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Preencha e envie para revisão.
          </p>
        </div>
      </header>

      <form onSubmit={enviar} className="space-y-3">
        <section className="space-y-3 rounded-2xl border bg-card p-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="entrada-mobile-produto">
              Produto
            </Label>
            <Input
              id="entrada-mobile-produto"
              value={form.nome_produto}
              onChange={(e) =>
                setCampo(
                  'nome_produto',
                  e.target.value
                )
              }
              placeholder="Nome do produto"
              autoComplete="off"
              className="h-12 rounded-xl text-base"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entrada-mobile-qtd">
              Quantidade
            </Label>
            <Input
              id="entrada-mobile-qtd"
              inputMode="decimal"
              value={form.quantidade}
              onChange={(e) =>
                setCampo(
                  'quantidade',
                  e.target.value
                )
              }
              placeholder="0,00"
              className="h-12 rounded-xl text-base"
              required
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-3.5">
          <div className="space-y-1.5">
            <Label>Setor</Label>
            <SearchSelect
              value={form.setor_id || 'all'}
              onChange={(value) =>
                setCampo(
                  'setor_id',
                  value === 'all'
                    ? ''
                    : value
                )
              }
              allLabel="Selecione o setor"
              placeholder="Selecione o setor"
              options={setoresPermitidos.map(
                (item) => ({
                  value: item.id,
                  label: item.nome,
                })
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Depósito</Label>
            <SearchSelect
              value={form.deposito_id || 'all'}
              onChange={(value) =>
                setCampo(
                  'deposito_id',
                  value === 'all'
                    ? ''
                    : value
                )
              }
              allLabel={
                form.setor_id
                  ? 'Selecione o depósito'
                  : 'Escolha o setor primeiro'
              }
              placeholder="Selecione o depósito"
              options={depositosDoSetor.map(
                (item) => ({
                  value: item.id,
                  label: `${item.numero || ''}${
                    item.nome
                      ? ` — ${item.nome}`
                      : ''
                  }`.trim(),
                })
              )}
            />
          </div>

          {form.deposito_id
            && gavetasDoDeposito.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Gaveta</Label>
                  <span className="text-[10px] font-semibold text-amber-700">
                    OBRIGATÓRIA
                  </span>
                </div>

                <SearchSelect
                  value={form.gaveta_id || 'all'}
                  onChange={(value) =>
                    setCampo(
                      'gaveta_id',
                      value === 'all'
                        ? ''
                        : value
                    )
                  }
                  allLabel="Selecione a gaveta"
                  placeholder="Selecione a gaveta"
                  options={gavetasDoDeposito.map(
                    (item) => ({
                      value: item.id,
                      label: `${item.codigo || ''}${
                        item.descricao
                          ? ` — ${item.descricao}`
                          : ''
                      }`,
                    })
                  )}
                />
              </div>
            ) : null}
        </section>

        <section className="rounded-2xl border bg-card p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <Label>Foto</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Opcional · corte automático 1:1
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/20">
              {form.foto_url ? (
                <Image
                  src={form.foto_url}
                  alt="Foto do produto"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Camera className="h-5 w-5 text-muted-foreground/60" />
              )}
            </div>
          </div>

          <MobileProductPhoto
            uploading={uploading}
            onFile={enviarFoto}
          />
        </section>

        <InlineNotice notice={notice} />

        <Button
          type="submit"
          className="h-12 w-full rounded-xl text-base font-semibold"
          disabled={saving || uploading || loading}
        >
          {saving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          {saving
            ? 'Enviando...'
            : 'Enviar para revisão'}
        </Button>
      </form>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Últimos envios
            </span>
          </div>

          {loadingRecentes ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {!loadingRecentes && recentes.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
            Nenhum envio ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {recentes.map((item) => (
              <StatusItem
                key={item.id}
                item={item}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
