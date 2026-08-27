import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const BalancaContext = createContext(null);

const BAUD_KEY = 'balanca_baud_rate';
const DEFAULT_BAUD = 9600;
const DATABITS_KEY = 'balanca_data_bits';
const STOPBITS_KEY = 'balanca_stop_bits';
const PARITY_KEY = 'balanca_parity';
const CASAS_KEY = 'balanca_casas_decimais';

function loadSetting(key, defaultValue) {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? saved : defaultValue;
  } catch {
    return defaultValue;
  }
}

function formatarPeso(peso, casasDecimais = 3) {
  if (peso === null || peso === undefined || isNaN(peso)) return '0';
  return Number(peso).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casasDecimais,
  });
}

/**
 * Faz o parse de um frame do protocolo Cougar p03 (contínuo) da balança Toledo.
 * O frame contém status, sinal, valor do peso e unidade (kg).
 * Ex.: " +0012345k" ou "M +0012345k" (em movimento) ou "O +9999999k" (sobrecarga)
 */
function parseFrameCougar(frame) {
  // Remove STX, ETX e outros caracteres de controle
  let str = frame.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  if (!str || str.length < 2) return null;

  // Cougar p03 contínuo: [status][+/-][peso][unidade]
  // O peso é o número imediatamente após o sinal de polaridade (+ ou -)
  // Ex.: " +001000k" → 1000, " -0000010k" → -10
  const signMatch = str.match(/([+-])\s*(\d+[.,]?\d*)/);
  if (signMatch) {
    const sign = signMatch[1] === '-' ? -1 : 1;
    const peso = parseFloat(signMatch[2].replace(',', '.')) * sign;
    if (!isNaN(peso)) return peso;
  }

  // Fallback: primeiro número encontrado (com sinal se houver)
  const numMatch = str.match(/-?\d+[.,]?\d*/);
  if (numMatch) {
    const peso = parseFloat(numMatch[0].replace(',', '.'));
    if (!isNaN(peso)) return peso;
  }

  return null;
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
  const [rawData, setRawData] = useState('');
  // rawData mantido apenas para debug interno — não é exibido na UI
  const [dataBits, setDataBits] = useState(() => parseInt(loadSetting(DATABITS_KEY, '8'), 10));
  const [stopBits, setStopBits] = useState(() => parseInt(loadSetting(STOPBITS_KEY, '1'), 10));
  const [parity, setParity] = useState(() => loadSetting(PARITY_KEY, 'none'));
  const [casasDecimais, setCasasDecimais] = useState(() => parseInt(loadSetting(CASAS_KEY, '3'), 10));

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const shouldStopRef = useRef(false);
  const ultimaLeituraRef = useRef(null);
  const casasDecimaisRef = useRef(casasDecimais);

  useEffect(() => { casasDecimaisRef.current = casasDecimais; }, [casasDecimais]);

  /**
   * Inicia o loop de leitura contínua do protocolo Cougar p03.
   * A balança envia frames continuamente — não é necessário enviar comandos.
   * Cada frame é delimitado por CR e/ou LF.
   */
  const iniciarLeituraContinua = useCallback(async () => {
    const port = portRef.current;
    if (!port || !port.readable) return;

    let reader;
    try {
      reader = port.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (!shouldStopRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        setRawData((prev) => (prev + chunk).slice(-300));

        // Processa frames completos (delimitados por CR ou LF)
        let nlIdx;
        while ((nlIdx = buffer.search(/[\r\n]/)) >= 0) {
          const frame = buffer.substring(0, nlIdx);
          let skip = 1;
          if (buffer[nlIdx] === '\r' && buffer[nlIdx + 1] === '\n') skip = 2;
          buffer = buffer.substring(nlIdx + skip);

          if (frame.length > 0) {
            const peso = parseFrameCougar(frame);
            if (peso !== null) {
              console.log('[Balanca] frame:', JSON.stringify(frame), '→ peso:', peso);
              const leitura = { peso, timestamp: new Date().toISOString() };
              ultimaLeituraRef.current = leitura;
              setUltimaLeitura(leitura);
            }
          }
        }

        // Fallback: sem delimitador mas buffer com dados suficientes — tenta parsear direto
        if (buffer.length >= 12 && !/[\r\n]/.test(buffer)) {
          const peso = parseFrameCougar(buffer);
          if (peso !== null) {
            const leitura = { peso, timestamp: new Date().toISOString() };
            ultimaLeituraRef.current = leitura;
            setUltimaLeitura(leitura);
          }
          buffer = '';
        }

        if (buffer.length > 256) buffer = '';
      }
    } catch (e) {
      if (!shouldStopRef.current) {
        if (e.name === 'NetworkError') {
          setStatus('desconectado');
          portRef.current = null;
          setPortaInfo(null);
          ultimaLeituraRef.current = null;
        }
      }
    } finally {
      if (reader) {
        try { reader.releaseLock(); } catch {}
      }
      readerRef.current = null;
    }
  }, []);

  /** Para o loop de leitura contínua e libera o reader. */
  const pararLeitura = useCallback(async () => {
    shouldStopRef.current = true;
    const reader = readerRef.current;
    if (reader) {
      try { await reader.cancel(); } catch {}
    }
    // Aguarda o loop terminar
    let attempts = 0;
    while (readerRef.current && attempts < 20) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
  }, []);

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
            await port.open({ baudRate, dataBits, stopBits, parity });
            if (cancelled) {
              try { await port.close(); } catch {}
              return;
            }
            portRef.current = port;
            setPortaInfo(port.getInfo());
            setStatus('conectado');
            shouldStopRef.current = false;
            iniciarLeituraContinua();
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
      shouldStopRef.current = true;
      const reader = readerRef.current;
      if (reader) { try { reader.cancel(); } catch {} }
      const port = portRef.current;
      if (port) { try { port.close(); } catch {} }
      portRef.current = null;
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
      // Para leitura existente e fecha porta antiga
      await pararLeitura();
      const oldPort = portRef.current;
      if (oldPort) {
        try { await oldPort.close(); } catch {}
        portRef.current = null;
      }
      await port.open({ baudRate, dataBits, stopBits, parity });
      portRef.current = port;
      setPortaInfo(port.getInfo());
      setStatus('conectado');
      shouldStopRef.current = false;
      iniciarLeituraContinua();
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
  }, [baudRate, dataBits, stopBits, parity, pararLeitura, iniciarLeituraContinua]);

  const desconectar = useCallback(async () => {
    await pararLeitura();
    const port = portRef.current;
    if (port) {
      try { await port.close(); } catch {}
      portRef.current = null;
    }
    setPortaInfo(null);
    setErro(null);
    setStatus('desconectado');
    ultimaLeituraRef.current = null;
    setRawData('');
  }, [pararLeitura]);

  /**
   * Retorna o peso atual da balança.
   * No modo contínuo Cougar p03, a balança envia leituras continuamente,
   * então este método retorna a leitura mais recente (se tiver < 2s) ou
   * aguarda até 3s por uma nova leitura.
   */
  const lerPeso = useCallback(async () => {
    const port = portRef.current;
    if (!port) return null;
    setLendo(true);
    setErro(null);
    try {
      // Se há leitura recente (< 2s), retorna imediatamente
      const atual = ultimaLeituraRef.current;
      if (atual && Date.now() - new Date(atual.timestamp).getTime() < 2000) {
        return atual.peso;
      }
      // Aguarda até 3s por uma nova leitura do stream contínuo
      const startTime = Date.now();
      while (Date.now() - startTime < 3000) {
        await new Promise((r) => setTimeout(r, 150));
        const leitura = ultimaLeituraRef.current;
        if (leitura && Date.now() - new Date(leitura.timestamp).getTime() < 2000) {
          return leitura.peso;
        }
      }
      throw new Error('timeout');
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'timeout') {
        setErro('Tempo esgotado: a balança não enviou leitura em 3 segundos. Verifique se está ligada e se o protocolo está configurado como Cougar p03 contínuo.');
      } else if (msg === 'porta_perdida') {
        setErro('A conexão com a balança foi perdida. Reconecte na página Balança.');
        setStatus('desconectado');
        portRef.current = null;
        setPortaInfo(null);
      } else {
        setErro(`Erro na leitura: ${msg}`);
      }
      return null;
    } finally {
      setLendo(false);
    }
  }, []);

  const trocarBaudRate = useCallback((novoBaud) => {
    setBaudRate(novoBaud);
    try { localStorage.setItem(BAUD_KEY, String(novoBaud)); } catch {}
  }, []);

  const trocarDataBits = useCallback((v) => {
    setDataBits(v);
    try { localStorage.setItem(DATABITS_KEY, String(v)); } catch {}
  }, []);

  const trocarStopBits = useCallback((v) => {
    setStopBits(v);
    try { localStorage.setItem(STOPBITS_KEY, String(v)); } catch {}
  }, []);

  const trocarParity = useCallback((v) => {
    setParity(v);
    try { localStorage.setItem(PARITY_KEY, v); } catch {}
  }, []);

  const trocarCasasDecimais = useCallback((v) => {
    setCasasDecimais(v);
    try { localStorage.setItem(CASAS_KEY, String(v)); } catch {}
  }, []);

  const value = {
    suportado,
    status,
    portaInfo,
    baudRate,
    dataBits,
    stopBits,
    parity,
    casasDecimais,
    ultimaLeitura,
    rawData,
    erro,
    lendo,
    conectar,
    desconectar,
    lerPeso,
    trocarBaudRate,
    trocarDataBits,
    trocarStopBits,
    trocarParity,
    trocarCasasDecimais,
    formatarPeso: (peso) => formatarPeso(peso, casasDecimais),
  };

  return <BalancaContext.Provider value={value}>{children}</BalancaContext.Provider>;
}

export function useBalanca() {
  const ctx = useContext(BalancaContext);
  if (!ctx) throw new Error('useBalanca deve ser usado dentro de BalancaProvider');
  return ctx;
}