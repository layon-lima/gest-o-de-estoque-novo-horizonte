import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Loader2, Plug, PlugZap, AlertTriangle, ExternalLink, Activity } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useBalanca } from '@/lib/balancaContext';

export default function BalancaStatusBadge() {
  const { suportado, status, erro, conectar, desconectar, rawData, ultimaLeitura, baudRate, dataBits, stopBits, parity } = useBalanca();
  const [open, setOpen] = useState(false);
  const [conectando, setConectando] = useState(false);

  const semDados = status === 'conectado' && !ultimaLeitura && !rawData;

  const dotClass = !suportado
    ? 'bg-gray-400'
    : status === 'conectado'
    ? semDados
      ? 'bg-amber-500 animate-pulse'
      : 'bg-green-500'
    : status === 'conectando'
    ? 'bg-amber-500 animate-pulse'
    : 'bg-red-500';

  const label = !suportado
    ? 'Balança não suportada'
    : status === 'conectado'
    ? semDados
      ? 'Conectada sem dados'
      : 'Balança Conectada'
    : status === 'conectando'
    ? 'Conectando...'
    : status === 'erro'
    ? 'Erro na balança'
    : 'Balança Desconectada';

  async function handleConectar() {
    setConectando(true);
    await conectar();
    setConectando(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill text-xs font-medium hover:bg-foreground/10 transition-colors"
        >
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
          <span className="text-sm font-semibold">{label}</span>
        </div>

        {!suportado && (
          <p className="text-xs text-muted-foreground">
            Seu navegador não suporta conexão serial. Use o Google Edge ou Chrome no desktop.
          </p>
        )}

        {suportado && erro && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{erro}</p>
          </div>
        )}

        {suportado && status === 'conectado' && !semDados && (
          <p className="text-xs text-muted-foreground">A balança está pronta para uso.</p>
        )}

        {suportado && semDados && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 p-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Balança conectada mas sem dados</p>
                <p>A porta abriu, mas nenhum dado está chegando. Verifique:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>O driver USB do conversor serial está instalado neste PC</li>
                  <li>O cabo USB está firme em ambas as pontas</li>
                  <li>A balança está ligada e enviando dados (protocolo Cougar p03)</li>
                  <li>O baud rate ({baudRate}) corresponde ao da balança</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="w-3.5 h-3.5" />
              <span>Config: {baudRate} baud, {dataBits} bits, stop {stopBits}, paridade {parity}</span>
            </div>
          </div>
        )}

        {suportado && (status === 'desconectado' || status === 'erro') && (
          <p className="text-xs text-muted-foreground">Clique para selecionar a porta USB da balança.</p>
        )}

        {suportado && (
          <Button
            type="button"
            className="w-full"
            size="sm"
            disabled={status === 'conectando' || conectando}
            onClick={status === 'conectado' ? desconectar : handleConectar}
          >
            {status === 'conectando' || conectando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
            ) : status === 'conectado' ? (
              <><PlugZap className="w-4 h-4" /> Desconectar</>
            ) : (
              <><Plug className="w-4 h-4" /> Conectar Balança</>
            )}
          </Button>
        )}

        <Link
          to="/balanca"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          <Scale className="w-3.5 h-3.5" />
          Configurações avançadas
          <ExternalLink className="w-3 h-3" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}