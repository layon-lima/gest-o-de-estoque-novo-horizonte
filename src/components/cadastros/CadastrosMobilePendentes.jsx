import { useEffect, useState } from 'react';
import { Check, Clock3, Loader2, RefreshCw, Smartphone, X } from 'lucide-react';

import { cadastrosMobileApi } from '@/api/cadastrosMobileClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const LABELS = {
  nome: 'Nome', codigo: 'Código', codigo_referencia: 'Código de referência', numero: 'Número',
  descricao: 'Descrição', setor_id: 'Setor', deposito_id: 'Depósito', gaveta_id: 'Gaveta',
  maquina_id: 'Máquina', unidade: 'Unidade', unidade_alt: 'Unidade alternativa',
  fator_conversao: 'Fator de conversão', estoque_minimo: 'Estoque mínimo',
  custo_unitario: 'Custo unitário', venda: 'Produto de venda', cor: 'Cor', icon: 'Ícone',
  controla_validade: 'Controla validade', tem_aba_mobile: 'Aparece no mobile',
  permite_inventario: 'Permite inventário',
};

export default function CadastrosMobilePendentes() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [editing, setEditing] = useState({});

  async function load() {
    setLoading(true);
    try {
      const result = await cadastrosMobileApi.listar('PENDENTE');
      setItems(result);
      setEditing(Object.fromEntries(result.map((item) => [item.id, { ...item.dados }])));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar pendências', description: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(item) {
    setBusy(item.id);
    try {
      await cadastrosMobileApi.aprovar(item.id, editing[item.id]);
      toast({ title: 'Cadastro aprovado', description: 'O registro oficial foi criado com sucesso.' });
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'A aprovação não foi concluída', description: error.message });
    } finally { setBusy(null); }
  }

  async function reject(item) {
    const motivo = window.prompt('Informe o motivo da rejeição:');
    if (!motivo?.trim()) return;
    setBusy(item.id);
    try {
      await cadastrosMobileApi.rejeitar(item.id, motivo.trim());
      toast({ title: 'Solicitação rejeitada' });
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Não foi possível rejeitar', description: error.message });
    } finally { setBusy(null); }
  }

  if (loading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="font-semibold">Aguardando revisão</h3><p className="text-sm text-muted-foreground">Revise os dados antes de criar o cadastro oficial.</p></div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>
      {items.length === 0 ? <Card className="rounded-2xl p-8 text-center text-muted-foreground"><Smartphone className="mx-auto mb-3 h-8 w-8" />Nenhum cadastro mobile pendente.</Card> : items.map((item) => (
        <Card key={item.id} className="overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 p-4">
            <div><div className="flex items-center gap-2"><Badge>{item.tipo}</Badge><span className="font-semibold">{item.dados?.nome || item.dados?.codigo || item.dados?.numero || 'Solicitação'}</span></div><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{item.solicitante_nome || 'Administrador'} · {new Date(item.created_date).toLocaleString('pt-BR')}</p></div>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Pendente</Badge>
          </div>
          <div className="grid gap-5 p-4 lg:grid-cols-[1fr_240px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(editing[item.id] || {}).filter(([key]) => key !== 'foto_url').map(([key, value]) => (
                <div key={key} className="space-y-1"><Label>{LABELS[key] || key}</Label>{typeof value === 'boolean' ? <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={String(value)} onChange={(e) => setEditing((all) => ({ ...all, [item.id]: { ...all[item.id], [key]: e.target.value === 'true' } }))}><option value="true">Sim</option><option value="false">Não</option></select> : <Input value={value ?? ''} onChange={(e) => setEditing((all) => ({ ...all, [item.id]: { ...all[item.id], [key]: e.target.value } }))} />}</div>
              ))}
            </div>
            <div className="space-y-3">
              {item.imagem_url ? <Image src={item.imagem_url} alt="Foto enviada" className="h-44 w-full rounded-xl border object-cover" /> : <div className="flex h-28 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Sem foto</div>}
              <Button className="w-full" disabled={busy === item.id} onClick={() => approve(item)}>{busy === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Aprovar</Button>
              <Button variant="outline" className="w-full text-destructive" disabled={busy === item.id} onClick={() => reject(item)}><X className="mr-2 h-4 w-4" />Rejeitar</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
