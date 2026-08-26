import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle2, AlertTriangle, ChevronRight, FolderOpen } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useEntidades } from '@/lib/useEntidades';
import InventarioConference from '@/components/inventario/InventarioConference';
import InventarioDetalhe from '@/components/inventario/InventarioDetalhe';

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Inventario() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [setorId, setSetorId] = useState('');
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [resumeId, setResumeId] = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  const { data, loading, reload: load } = useEntidades({
    Setor: {},
    Produto: {},
    Deposito: {},
    Maquina: {},
    Gaveta: {},
    Lote: {},
    Inventario: { sort: '-data', limit: 200 },
  });
  const {
    Setor: setores, Produto: produtos, Deposito: depositos, Maquina: maquinas,
    Gaveta: gavetas, Lote: lotes, Inventario: registros,
  } = data;

  const setor = setores.find((s) => s.id === setorId);

  function iniciar() {
    if (!setor) {
      toast({ variant: 'destructive', title: 'Setor obrigatório', description: 'Selecione o setor para iniciar o inventário.' });
      return;
    }
    setResumeId(null);
    setConferenceOpen(true);
  }

  function abrirDoc(r) {
    setSetorId(r.setor_id);
    setResumeId(r.id);
    setConferenceOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Inventário
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Conferência tete-a-tete do estoque. Compare a contagem física com o saldo do sistema.</p>
      </header>

      <Card className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Setor *</label>
          <Select value={setorId || 'none'} onValueChange={(v) => setSetorId(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione qualquer setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Selecione —</SelectItem>
              {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={iniciar} disabled={!setor}>
          <ClipboardList className="w-4 h-4 mr-2" /> Iniciar Inventário
        </Button>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico de conferências</h2>
        {registros.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma conferência salva ainda.</Card>
        ) : (
          <div className="space-y-2">
            {registros.map((r) => {
              const aberto = r.status === 'aberto';
              return (
                <Card key={r.id} className="p-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => (aberto ? abrirDoc(r) : setDetalhe(r))}>
                  <div className={`shrink-0 w-9 h-9 rounded-md flex items-center justify-center ${aberto ? 'bg-amber-100 text-amber-600' : r.resultado === 'consistente' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {aberto ? <FolderOpen className="w-4 h-4" /> : r.resultado === 'consistente' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{r.numero}</span>
                      <p className="font-medium truncate">{r.setor_nome || '—'}</p>
                      {aberto ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">Em aberto</Badge>
                      ) : r.resultado === 'consistente' ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Consistente</Badge>
                      ) : (
                        <Badge variant="destructive">{r.total_divergencias} diverg.</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{fmtData(r.data)} · {r.criterios_descricao || '—'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {(setor || resumeId) && (
        <InventarioConference
          open={conferenceOpen}
          onOpenChange={(o) => { setConferenceOpen(o); if (!o) setResumeId(null); }}
          setor={setor}
          produtos={produtos}
          depositos={depositos}
          maquinas={maquinas}
          gavetas={gavetas}
          lotes={lotes}
          user={user}
          onSaved={load}
          initialInventarioId={resumeId}
        />
      )}

      <InventarioDetalhe inventario={detalhe} open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)} />
    </div>
  );
}