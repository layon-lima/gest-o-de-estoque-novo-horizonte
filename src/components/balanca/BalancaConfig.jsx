import { Settings, Info } from 'lucide-react';
import { useBalanca } from '@/lib/balancaContext';

const BAUD_OPTIONS = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
const DATABITS_OPTIONS = [7, 8];
const STOPBITS_OPTIONS = [1, 2];
const PARITY_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'even', label: 'Par (Even)' },
  { value: 'odd', label: 'Ímpar (Odd)' },
];
const CASAS_OPTIONS = [0, 1, 2, 3];

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50';

export default function BalancaConfig() {
  const {
    status, baudRate, dataBits, stopBits, parity, casasDecimais,
    trocarBaudRate, trocarDataBits, trocarStopBits, trocarParity, trocarCasasDecimais,
    desconectar,
  } = useBalanca();

  const conectado = status === 'conectado';

  async function trocar(trocarFn, valor, atual) {
    if (valor === atual) return;
    if (conectado) await desconectar();
    trocarFn(valor);
  }

  return (
    <div className="glass-tinted rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Configuração Serial</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Ajuste os parâmetros da porta serial caso a balança não responda. Alterações exigem reconexão.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Baud rate</label>
          <select
            value={baudRate}
            onChange={(e) => trocar(trocarBaudRate, parseInt(e.target.value, 10), baudRate)}
            className={selectClass}
          >
            {BAUD_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Data bits</label>
          <select
            value={dataBits}
            onChange={(e) => trocar(trocarDataBits, parseInt(e.target.value, 10), dataBits)}
            className={selectClass}
          >
            {DATABITS_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Stop bits</label>
          <select
            value={stopBits}
            onChange={(e) => trocar(trocarStopBits, parseInt(e.target.value, 10), stopBits)}
            className={selectClass}
          >
            {STOPBITS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Paridade</label>
          <select
            value={parity}
            onChange={(e) => trocar(trocarParity, e.target.value, parity)}
            className={selectClass}
          >
            {PARITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Casas decimais</label>
          <select
            value={casasDecimais}
            onChange={(e) => trocar(trocarCasasDecimais, parseInt(e.target.value, 10), casasDecimais)}
            className={selectClass}
          >
            {CASAS_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border rounded-md p-3">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>
          <p><strong>Configuração típica Toledo Prix:</strong> 9600 baud, 8 data bits, 1 stop bit, paridade Nenhuma.</p>
          <p className="mt-1"><strong>Casas decimais:</strong> define quantos zeros à direita são decimais. Ex.: se a balança envia "12345000" e o peso real é "1.234,500", configure 3 casas decimais.</p>
        </div>
      </div>
    </div>
  );
}