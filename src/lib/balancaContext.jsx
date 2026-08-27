import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const BalancaContext = createContext(null);

const BAUD_KEY = 'balanca_baud_rate';
const DEFAULT_BAUD = 9600;

/**
 * Faz o parse da resposta serial da balança Toledo Prix.
 * A resposta típica contém um status, o valor do peso e a unidade (kg).
 * Ex.: "=        12450 kg" ou "S S     12345 kg"
 */
function parsePesoToledo(resposta) {
  const str = resposta.replace(/[\x00-\x08\x0E-\x1F]/g, '').trim();
  // Tenta encontrar o número imediatamente antes da unidade "kg"
  const unitMatch = str.match(/(-?\d+[.,]?\d*)\s*k?g/i);
  if (unitMatch) {
    const peso = parseFloat(unitMatch[1].replace(',', '.'));
    if (!isNaN(peso)) return peso;
  }
  // Fallback: último número encontrado na string
  const matches = str.match(/\d+[.,]?\d*/g);
  if (!matches || matches.length === 0) return null;
  const peso = parseFloat(matches[matches.length - 1].replace(',', '.'));
  return isNaN(peso) ? null : peso;
}

export function BalancaProvider({ children }) {
  const [suportado, setSuportado] = useState(true);
  const [status, setStatus] = useState('desconectado'); // desconectado | conectando | conectado | erro | nao_suportado
  const [portaInfo, setPortaInfo] = useState(null);
  const [baudRate, setBaudRate] = useState(() => {
    try {
      const saved = localStorage.getItem(BAUD_KEY);
      return saved ? parseInt(saved, 10) : DEFAULT_BAUD;
    } catch {
      return DEFAULT_BAUD;
    }
  });
  const [ultimaLeitura, setUltimaLeitura] = useState(null);
  const [erro, setErro] = useState(null);
  const [lendo, setLendo] = useState(false);
  const portRef = useRef(null);

  // Feature detection + auto-reconexão com portas já autorizadas
  useEffect(() => {
    if (!('serial' in navigator)) {
      setSuportado(false);
      setStatus('nao_suportado');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0 && !cancelled) {
          const port = ports[0];
          try {
            await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
            if (cancelled) {
              try { await port.close(); } catch {}
              return;
            }
            portRef.current = port;
            setPortaInfo(port.getInfo());
            setStatus('conectado');
          } catch {
            // Silencioso — usuário conecta manualmente
          }
        }
      } catch {
        // Silencioso
      }
    })();
    return () => {
      cancelled = true;
      const port = portRef.current;
      if (port) {
        try { port.close(); } catch {}
        portRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectar = useCallback(async () => {
    if (!('serial' in navigator)) {
      setSuportado(false);
      return false;
    }
    setErro(null);
    setStatus('conectando');
    try {
      const port = await navigator.serial.requestPort();
      const oldPort = portRef.current;
      if (oldPort) {
        try { await oldPort.close(); } catch {}
        portRef.current = null;
      }
      await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
      portRef.current = port;
      setPortaInfo(port.getInfo());
      setStatus('conectado');
      return true;
    } catch (e) {
      if (e.name === 'NotFoundError' || e.name === 'AbortError') {
        setStatus('desconectado');
      } else if (e.name === 'InvalidStateError') {
        setStatus('erro');
        setErro('A porta já está aberta por outro aplicativo. Feche o outro programa e tente novamente.');
      } else {
        setStatus('erro');
        setErro(`Erro ao abrir porta: ${e.message || e}`);
      }
      return false;
    }
  }, [baudRate]);

  const desconectar = useCallback(async () => {
    const port = portRef.current;
    if (port) {
      try { await port.close(); } catch {}
      portRef.current = null;
    }
    setPortaInfo(null);
    setErro(null);
    setStatus('desconectado');
  }, []);

  const lerPeso = useCallback(async () => {
    const port = portRef.current;
    if (!port) return null;
    setLendo(true);
    setErro(null);
    let reader = null;
    let writer = null;
    try {
      if (!port.writable || !port.readable) {
        throw new Error('porta_perdida');
      }
      // Envia comando "S" (peso estável) + CR LF
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode('S\r\n'));
      writer.releaseLock();
      writer = null;

      // Lê a resposta até encontrar LF ou estourar o timeout
      reader = port.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const startTime = Date.now();
      while (true) {
        if (Date.now() - startTime > 3000) throw new Error('timeout');
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes('\n')) break;
      }

      const peso = parsePesoToledo(buffer);
      if (peso === null) throw new Error('resposta_invalida');
      setUltimaLeitura({ peso, timestamp: new Date().toISOString() });
      return peso;
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'timeout') {
        setErro('Tempo esgotado: a balança não respondeu em 3 segundos. Verifique se está ligada e configurada (Passo 2 do guia).');
      } else if (msg === 'resposta_invalida') {
        setErro('Resposta inválida da balança. Confirme se o protocolo está como PRT5 (Passo 2 do guia).');
      } else if (msg === 'porta_perdida') {
        setErro('A conexão com a balança foi perdida. Reconecte na página Balança.');
        setStatus('desconectado');
        portRef.current = null;
        setPortaInfo(null);
      } else {
        setErro(`Erro na leitura: ${msg}`);
        if (e.name === 'NetworkError') {
          setStatus('desconectado');
          portRef.current = null;
          setPortaInfo(null);
        }
      }
      return null;
    } finally {
      if (reader) { try { reader.releaseLock(); } catch {} }
      if (writer) { try { writer.releaseLock(); } catch {} }
      setLendo(false);
    }
  }, []);

  const trocarBaudRate = useCallback((novoBaud) => {
    setBaudRate(novoBaud);
    try { localStorage.setItem(BAUD_KEY, String(novoBaud)); } catch {}
  }, []);

  const value = {
    suportado,
    status,
    portaInfo,
    baudRate,
    ultimaLeitura,
    erro,
    lendo,
    conectar,
    desconectar,
    lerPeso,
    trocarBaudRate,
  };

  return <BalancaContext.Provider value={value}>{children}</BalancaContext.Provider>;
}

export function useBalanca() {
  const ctx = useContext(BalancaContext);
  if (!ctx) throw new Error('useBalanca deve ser usado dentro de BalancaProvider');
  return ctx;
}