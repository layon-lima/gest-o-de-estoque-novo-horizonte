import { Scale, Loader2, Unlink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBalanca } from '@/lib/balancaContext';
import { useToast } from '@/components/ui/use-toast';

const BAUD_OPTIONS = [4800, 9600, 19200];

export default function BalancaControles() {
  const { suportado, status, baudRate, ultimaLeitura, lendo, conectar, desconectar, lerPeso, trocarBaudRate } = useBalanca();
  const { toast } = useToast();

  const conectado = status === 'conectado';

  async function handleTestar() {
    const peso = await lerPeso();
    if (peso !== null && peso !== undefined) {
      toast({ title: 'Leitura bem-sucedida!', description: `${peso} kg lidos da balança.` });
    } else {
      toast({ variant: 'destructive', title: 'Falha na leitura', description: 'Verifique o guia de instalação abaixo.' });
    }
  }

  async function handleTrocarBaud(novo) {
    if (novo === baudRate) return;
    if (conectado) await desconectar();
    trocarBaudRate(novo);
  }

  return (
    <div className="glass-tinted rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> Controles da Balança
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Baud rate:</label>
          <select
            value={baudRate}
            onChange={(e) => handleTrocarBaud(parseInt(e.target.value, 10))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            disabled={!suportado}
          >
            {BAUD_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Display grande do peso */}
      <div className="flex flex-col items-center justify-center py-6 rounded-lg bg-muted/40 border">
        {lendo ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Lendo peso...</p>
          </div>
        ) : ultimaLeitura ? (
          <>
            <p className="text-4xl sm:text-5xl font-bold text-primary tabular-nums">{ultimaLeitura.peso}</p>
            <p className="text-sm text-muted-foreground font-medium mt-1">kg</p>
          </>
        ) : (
          <>
            <p className="text-4xl sm:text-5xl font-bold text-muted-foreground/40 tabular-nums">0</p>
            <p className="text-sm text-muted-foreground font-medium mt-1">kg</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!conectado ? (
          <Button onClick={conectar} disabled={!suportado || status === 'conectando'} className="flex-1 min-w-[160px]">
            {status === 'conectando' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
            {status === 'conectando' ? 'Conectando...' : 'Conectar Balança'}
          </Button>
        ) : (
          <Button variant="outline" onClick={desconectar} className="flex-1 min-w-[160px]">
            <Unlink className="w-4 h-4 mr-2" /> Desconectar
          </Button>
        )}
        <Button variant="secondary" onClick={handleTestar} disabled={!conectado || lendo} className="flex-1 min-w-[160px]">
          {lendo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {lendo ? 'Lendo...' : 'Testar Leitura'}
        </Button>
      </div>
      {conectado && (
        <p className="text-xs text-muted-foreground text-center">Posicione o peso na balança e clique em "Testar Leitura".</p>
      )}
    </div>
  );
}