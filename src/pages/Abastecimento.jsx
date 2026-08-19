import { useState, useEffect, useMemo } from 'react';
import { ScanLine, List, Fuel, Search, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  findSetorCombustivel, produtosCombustivel,
  registrarAbastecimentoPendente, confirmarAbastecimento, cancelarAbastecimento,
} from '@/lib/abastecimento';
import { formatQtd } from '@/lib/format';
import QrScanner from '@/components/abastecimento/QrScanner';
import AbastecimentoForm from '@/components/abastecimento/AbastecimentoForm';
import AbastecimentoRow from '@/components/abastecimento/AbastecimentoRow';
import AbastecimentoPendentes from '@/components/abastecimento/AbastecimentoPendentes';

export default function Abastecimento() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [sucesso, setSucesso] = useState(false);

  const [scannerAberto, setScannerAberto] = useState(false);
  const [selecaoManual, setSelecaoManual] = useState(false);
  const [maquinaSelecionada, setMaquinaSelecionada] = useState(null);
  const [buscaMaquina, setBuscaMaquina] = useState('');
  const [aba, setAba] = useState('abastecer');

  const podeConfirmar = user?.role === 'admin' || user?.pode_confirmar_abastecimento === true;

  const setorCombustivel = useMemo(() => findSetorCombustivel(setores), [setores]);
  const combustiveis = useMemo(
    () => produtosCombustivel(produtos, setorCombustivel?.id),
    [produtos, setorCombustivel]
  );

  const maquinasFiltradas = useMemo(() => {
    const q = buscaMaquina.toLowerCase().trim();
    return maquinas
      .filter((m) => m.permite_abastecimento === true)
      .filter((m) =>
        !q ||
        (m.codigo || '').toLowerCase().includes(q) ||
        (m.nome || '').toLowerCase().includes(q)
      );
  }, [maquinas, buscaMaquina]);

  const pendentes = useMemo(
    () => abastecimentos.filter((a) => (a.status || 'pendente') === 'pendente'),
    [abastecimentos]
  );
  const recentes = useMemo(
    () => abastecimentos.filter((a) => (a.status || 'pendente') !== 'pendente'),
    [abastecimentos]
  );

  async function load() {
    setLoading(true);
    const [m, p, s, l, movs, abs] = await Promise.all([
      base44.entities.Maquina.list(),
      base44.entities.Produto.list(),
      base44.entities.Setor.list(),
      base44.entities.Lote.list(),
      base44.entities.Movimentacao.list('-data', 100),
      base44.entities.Abastecimento.list('-data', 200),
    ]);
    setMaquinas(m);
    setProdutos(p);
    setSetores(s);
    setLotes(l);
    setMovimentacoes(movs);
    setAbastecimentos(abs);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function handleScan(decoded) {
    setScannerAberto(false);
    const maq = maquinas.find((m) => m.id === decoded || m.id === String(decoded).trim());
    if (!maq) {
      toast({ variant: 'destructive', title: 'Máquina não encontrada', description: 'QR Code inválido ou máquina não cadastrada.' });
      return;
    }
    if (maq.permite_abastecimento !== true) {
      toast({ variant: 'destructive', title: 'Máquina não habilitada', description: 'Esta máquina não permite abastecimento.' });
      return;
    }
    setMaquinaSelecionada(maq);
    setSelecaoManual(false);
  }

  async function handleSubmit({ produto, quantidade, observacao, foto_url }) {
    setSaving(true);
    try {
      await registrarAbastecimentoPendente({
        maquina: maquinaSelecionada,
        produto,
        quantidade,
        observacao,
        operador: user?.full_name || user?.email || '',
        foto_url,
      });
      toast({ title: 'Abastecimento registrado', description: 'Aguardando confirmação de um usuário autorizado para baixar o estoque.' });
      setMaquinaSelecionada(null);
      setSucesso(true);
      setTimeout(() => setSucesso(false), 4000);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao registrar', description: err.message });
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(abast) {
    const maquina = maquinas.find((m) => m.id === abast.maquina_id);
    const produto = produtos.find((p) => p.id === abast.produto_id);
    if (!maquina || !produto) {
      toast({ variant: 'destructive', title: 'Dados indisponíveis', description: 'Máquina ou combustível não encontrados.' });
      return;
    }
    setSavingId(abast.id);
    try {
      await confirmarAbastecimento({
        abast,
        maquina,
        produto,
        confirmado_por: user?.full_name || user?.email || '',
        setores,
        lotes,
        movimentacoes,
      });
      toast({ title: 'Baixa confirmada', description: `${produto.nome} baixado em ${formatQtd(abast.quantidade)} ${produto.unidade || 'un'}.` });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao confirmar', description: err.message });
    } finally {
      setSavingId(null);
    }
  }

  async function handleCancel(abast) {
    setSavingId(abast.id);
    try {
      await cancelarAbastecimento(abast.id);
      toast({ title: 'Abastecimento cancelado' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao cancelar', description: err.message });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fuel className="w-6 h-6 text-amber-500" />
          Abastecimento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {podeConfirmar
            ? 'Registre abastecimentos e confirme as baixas pendentes.'
            : 'Leia o QR Code da máquina e registre o combustível abastecido.'}
        </p>
      </header>

      {!setorCombustivel && !loading && (
        <Card className="p-4 border-amber-300 bg-amber-50 text-amber-800 text-sm">
          Nenhum setor de <strong>Combustíveis</strong> encontrado. Cadastre um setor com o nome contendo "Combustível" e vincule os produtos de combustível a ele.
        </Card>
      )}

      {sucesso && (
        <Card className="p-4 border-emerald-300 bg-emerald-50 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          Abastecimento enviado! Aguarde a confirmação da baixa por um usuário autorizado.
        </Card>
      )}

      {podeConfirmar && (
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          <button
            onClick={() => setAba('abastecer')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${aba === 'abastecer' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            Abastecer
          </button>
          <button
            onClick={() => setAba('pendentes')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${aba === 'pendentes' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            Aguardando confirmação
            {pendentes.length > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white">{pendentes.length}</Badge>
            )}
          </button>
        </div>
      )}

      {(!podeConfirmar || aba === 'abastecer') && (
        !maquinaSelecionada ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button size="lg" className="h-20 text-base" onClick={() => setScannerAberto(true)}>
                <ScanLine className="w-6 h-6 mr-2" />
                Escanear QR Code
              </Button>
              <Button size="lg" variant="outline" className="h-20 text-base" onClick={() => setSelecaoManual((v) => !v)}>
                <List className="w-6 h-6 mr-2" />
                Selecionar máquina
              </Button>
            </div>

            {selecaoManual && (
              <Card className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar máquina por código ou nome…"
                    value={buscaMaquina}
                    onChange={(e) => setBuscaMaquina(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
                  {maquinasFiltradas.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma máquina encontrada.</p>
                  )}
                  {maquinasFiltradas.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setMaquinaSelecionada(m); setSelecaoManual(false); setBuscaMaquina(''); }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                        {(m.codigo || '?').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{m.nome}</p>
                        <p className="text-xs font-mono text-muted-foreground">{m.codigo}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <div>
              <h3 className="font-semibold mb-3 text-sm">Abastecimentos recentes</h3>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : recentes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum abastecimento registrado.</p>
              ) : (
                <div className="space-y-2">
                  {recentes.map((a) => (
                    <AbastecimentoRow key={a.id} abast={a} maquinas={maquinas} produtos={produtos} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <AbastecimentoForm
            maquina={maquinaSelecionada}
            combustiveis={combustiveis}
            saving={saving}
            onSubmit={handleSubmit}
            onBack={() => setMaquinaSelecionada(null)}
          />
        )
      )}

      {podeConfirmar && aba === 'pendentes' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            Confirme a baixa após conferir a foto do painel do abastecedor.
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <AbastecimentoPendentes
              pendentes={pendentes}
              maquinas={maquinas}
              produtos={produtos}
              savingId={savingId}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          )}
        </div>
      )}

      <QrScanner open={scannerAberto} onClose={() => setScannerAberto(false)} onScan={handleScan} />
    </div>
  );
}