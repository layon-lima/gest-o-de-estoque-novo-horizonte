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

/** Converte string para representação hexadecimal para diagnóstico de protocolo. */
function bytesToHex(str) {
  return Array.from(str).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/** Verifica se um erro indica que o dispositivo físico foi removido. */
function isDeviceLostError(e) {
  const errName = e.name || '';
  const errMsg = (e.message || String(e)).toLowerCase();
  return (
    errName === 'NetworkError' ||
    errMsg.includes('device has been lost') ||
    errMsg.includes('port is not open') ||
    errMsg.includes('the port is no longer') ||
    errMsg.includes('usb device')
  );
}

const MAX_RETRIES = 5;

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
  const [dataBits, setDataBits] = useState(() => parseInt(loadSetting(DATABITS_KEY, '8'), 10));
  const [stopBits, setStopBits] = useState(() => parseInt(loadSetting(STOPBITS_KEY, '1'), 10));
  const [parity, setParity] = useState(() => loadSetting(PARITY_KEY, 'none'));
  const [casasDecimais, setCasasDecimais] = useState(() => parseInt(loadSetting(CASAS_KEY, '3'), 10));

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const shouldStopRef = useRef(false);
  const ultimaLeituraRef = useRef(null);
  const dadosRecebidosRef = useRef(false);
  const rawDataRef = useRef('');
  const loopRunningRef = useRef(false);
  const lastRawUpdateRef = useRef(0);
  const casasDecimaisRef = useRef(casasDecimais);
  const baudRateRef = useRef(baudRate);
  const dataBitsRef = useRef(dataBits);
  const stopBitsRef = useRef(stopBits);
  const parityRef = useRef(parity);

  useEffect(() => {
    casasDecimaisRef.current = casasDecimais;
    baudRateRef.current = baudRate;
    dataBitsRef.current = dataBits;
    stopBitsRef.current = stopBits;
    parityRef.current = parity;
  }, [casasDecimais, baudRate, dataBits, stopBits, parity]);

  /**
   * Inicia o loop de leitura contínua do protocolo Cougar p03 com WATCHDOG.
   * Se o loop morrer por qualquer motivo (sem shouldStop), reinicia automaticamente
   * com backoff exponencial até MAX_RETRIES tentativas.
   * A balança envia frames continuamente — não é necessário enviar comandos.
   * Cada frame é delimitado por CR e/ou LF.
   */
  const iniciarLeituraContinua = useCallback(async () => {
    const port = portRef.current;
    if (!port) return;

    // Guarda: não inicia loop duplicado
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    shouldStopRef.current = false;
    let tentativas = 0;

    try {
      while (!shouldStopRef.current && tentativas < MAX_RETRIES) {
        // Se a porta não é mais legível, o dispositivo foi removido fisicamente
        if (!port.readable) {
          if (!shouldStopRef.current) {
            setStatus('desconectado');
            portRef.current = null;
            setPortaInfo(null);
            ultimaLeituraRef.current = null;
          }
          return;
        }

        let reader;
        try {
          reader = port.readable.getReader();
          readerRef.current = reader;
          const decoder = new TextDecoder();
          let buffer = '';
          tentativas = 0; // Resetou — leitura está funcionando

          while (!shouldStopRef.current) {
            const { value, done } = await reader.read();
            if (done) break;
            dadosRecebidosRef.current = true;
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            rawDataRef.current = (rawDataRef.current + chunk).slice(-300);

            // Throttle: atualiza estado de rawData no máximo 2x por segundo
            const now = Date.now();
            if (now - lastRawUpdateRef.current > 500) {
              lastRawUpdateRef.current = now;
              setRawData(rawDataRef.current);
            }

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
                  const anterior = ultimaLeituraRef.current;
                  // Só atualiza a tela quando o peso muda — espelha o visor físico da balança
                  if (!anterior || anterior.peso !== peso) {
                    const leitura = { peso, timestamp: new Date().toISOString() };
                    ultimaLeituraRef.current = leitura;
                    setUltimaLeitura(leitura);
                  } else {
                    // Atualiza só o timestamp para que lerPeso saiba que a leitura é fresca
                    ultimaLeituraRef.current = { ...anterior, timestamp: new Date().toISOString() };
                  }
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
          if (shouldStopRef.current) break;

          // Erro fatal: dispositivo foi removido fisicamente
          if (isDeviceLostError(e) || !port.readable) {
            setStatus('desconectado');
            portRef.current = null;
            setPortaInfo(null);
            ultimaLeituraRef.current = null;
            return;
          }

          // Erro recuperável: incrementa tentativas e tenta novamente
          tentativas++;
          console.warn(`[Balanca] Loop reiniciando após erro (tentativa ${tentativas}/${MAX_RETRIES}):`, e);
          if (tentativas < MAX_RETRIES) {
            // Backoff exponencial: 1s, 2s, 3s, 4s...
            await new Promise(r => setTimeout(r, 1000 * tentativas));
          }
        } finally {
          if (reader) {
            try { reader.releaseLock(); } catch {}
          }
          readerRef.current = null;
        }
      }

      // Esgotou as tentativas sem shouldStop — sinaliza erro ao usuário
      if (!shouldStopRef.current && tentativas >= MAX_RETRIES) {
        setStatus('erro');
        const raw = rawDataRef.current || '';
        if (raw) {
          setErro(`A balança parou de responder após ${MAX_RETRIES} tentativas. Últimos dados recebidos (hex): ${bytesToHex(raw)}. Verifique o cabo USB, o driver do conversor serial e se a balança está ligada.`);
        } else {
          setErro(`Não foi possível manter a comunicação com a balança após ${MAX_RETRIES} tentativas. Verifique o cabo USB, o driver do conversor serial e se a balança está ligada.`);
        }
      }
    } finally {
      loopRunningRef.current = false;
    }
  }, []);

  /** Para o loop de leitura contínua e libera o reader (com timeout para não travar). */
  const pararLeitura = useCallback(async () => {
    shouldStopRef.current = true;
    const reader = readerRef.current;
    if (reader) {
      try {
        // Timeout de 2s para não travar indefinidamente se o reader travou
        await Promise.race([
          reader.cancel(),
          new Promise(r => setTimeout(r, 2000)),
        ]);
      } catch {}
    }
    // Aguarda o loop terminar (máx 2s)
    let attempts = 0;
    while (loopRunningRef.current && attempts < 40) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
  }, []);

  // Tenta abrir uma porta já autorizada e iniciar a leitura contínua
  const tentarAutoConectar = useCallback(async (port) => {
    if (!port || portRef.current) return;
    try {
      await port.open({
        baudRate: baudRateRef.current,
        dataBits: dataBitsRef.current,
        stopBits: stopBitsRef.current,
        parity: parityRef.current,
      });
      portRef.current = port;
      setPortaInfo(port.getInfo());
      setStatus('conectado');
      shouldStopRef.current = false;
      iniciarLeituraContinua();
    } catch (e) {
      // Porta não autorizada ou em uso — ignora silenciosamente na auto-conexão
      // mas se for InvalidStateError (já aberta), reutiliza a porta
      if (e.name === 'InvalidStateError') {
        portRef.current = port;
        setPortaInfo(port.getInfo());
        setStatus('conectado');
        shouldStopRef.current = false;
        if (!loopRunningRef.current) iniciarLeituraContinua();
      }
    }
  }, [iniciarLeituraContinua]);

  // Feature detection + auto-conexão ao plugar o cabo (porta já autorizada)
  useEffect(() => {
    if (!('serial' in navigator)) {
      setSuportado(false);
      setStatus('nao_suportado');
      return;
    }

    // Conecta portas já autorizadas que existem no momento da montagem
    let cancelled = false;
    (async () => {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0 && !cancelled) {
          await tentarAutoConectar(ports[0]);
        }
      } catch {
        // Silencioso
      }
    })();

    // Quando um cabo é plugado fisicamente, tenta conectar automaticamente
    const handleConnect = (event) => {
      if (cancelled || portRef.current) return;
      tentarAutoConectar(event.target);
    };

    // Quando o cabo é desconectado fisicamente, atualiza o status
    const handleDisconnect = (event) => {
      if (portRef.current === event.target) {
        shouldStopRef.current = true;
        const reader = readerRef.current;
        if (reader) { try { reader.cancel(); } catch {} }
        portRef.current = null;
        setPortaInfo(null);
        setStatus('desconectado');
        ultimaLeituraRef.current = null;
      }
    };

    navigator.serial.addEventListener('connect', handleConnect);
    navigator.serial.addEventListener('disconnect', handleDisconnect);

    return () => {
      cancelled = true;
      shouldStopRef.current = true;
      navigator.serial.removeEventListener('connect', handleConnect);
      navigator.serial.removeEventListener('disconnect', handleDisconnect);
      const reader = readerRef.current;
      if (reader) { try { reader.cancel(); } catch {} }
      const port = portRef.current;
      if (port) { try { port.close(); } catch {} }
      portRef.current = null;
      loopRunningRef.current = false;
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
        // Porta já aberta — reutiliza
        portRef.current = portRef.current;
        setStatus('conectado');
        if (!loopRunningRef.current) {
          shouldStopRef.current = false;
          iniciarLeituraContinua();
        }
        return true;
      } else if (e.name === 'SecurityError') {
        setStatus('erro');
        setErro('Acesso negado pelo navegador. Use Chrome ou Edge em desktop via HTTPS.');
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
   * então este método retorna a leitura mais recente (se tiver < 4s) ou
   * aguarda até 8s por uma nova leitura.
   */
  const lerPeso = useCallback(async () => {
    let port = portRef.current;
    if (!port) return null;

    // Se a porta morreu (dispositivo removido), limpa e falha
    if (!port.readable) {
      setStatus('desconectado');
      portRef.current = null;
      setPortaInfo(null);
      ultimaLeituraRef.current = null;
      setErro('A balança foi desconectada. Conecte novamente.');
      return null;
    }

    // Se o loop não está rodando (morreu por erro), reinicia
    if (!loopRunningRef.current && !readerRef.current) {
      shouldStopRef.current = false;
      iniciarLeituraContinua();
    }

    setLendo(true);
    setErro(null);
    try {
      // Se há leitura recente (< 4s), retorna imediatamente
      const atual = ultimaLeituraRef.current;
      if (atual && Date.now() - new Date(atual.timestamp).getTime() < 4000) {
        return atual.peso;
      }
      // Aguarda até 8s por uma nova leitura do stream contínuo
      const startTime = Date.now();
      while (Date.now() - startTime < 8000) {
        await new Promise((r) => setTimeout(r, 150));
        const leitura = ultimaLeituraRef.current;
        if (leitura && Date.now() - new Date(leitura.timestamp).getTime() < 4000) {
          return leitura.peso;
        }
      }
      throw new Error('timeout');
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'timeout') {
        const raw = rawDataRef.current || '';
        if (dadosRecebidosRef.current && raw) {
          setErro(`A balança está enviando dados mas não foi possível interpretar o peso. Dados recebidos (hex): ${bytesToHex(raw)}. Verifique se o protocolo da balança está como Cougar p03 contínuo. Se o problema persistir, copie estes dados e entre em contato com o suporte.`);
        } else {
          setErro('Tempo esgotado: a balança não enviou dados em 8 segundos. Verifique se está ligada, se o cabo está conectado e se o driver USB do conversor serial está instalado neste PC.');
        }
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
  }, [iniciarLeituraContinua]);

  /** Tenta reconectar usando a última porta autorizada (sem pedir seleção ao usuário). */
  const reconectar = useCallback(async () => {
    if (!('serial' in navigator)) {
      setSuportado(false);
      return false;
    }
    setErro(null);
    setStatus('conectando');

    // Tenta usar portas já autorizadas
    try {
      const ports = await navigator.serial.getPorts();
      if (ports.length > 0) {
        const port = ports[0];
        await pararLeitura();
        const oldPort = portRef.current;
        if (oldPort) {
          try { await oldPort.close(); } catch {}
          portRef.current = null;
        }
        try {
          await port.open({
            baudRate: baudRateRef.current,
            dataBits: dataBitsRef.current,
            stopBits: stopBitsRef.current,
            parity: parityRef.current,
          });
          portRef.current = port;
          setPortaInfo(port.getInfo());
          shouldStopRef.current = false;
          ultimaLeituraRef.current = null;
          dadosRecebidosRef.current = false;
          rawDataRef.current = '';
          setUltimaLeitura(null);
          setRawData('');
          setStatus('conectado');
          iniciarLeituraContinua();
          return true;
        } catch (e) {
          if (e.name === 'InvalidStateError') {
            portRef.current = port;
            setPortaInfo(port.getInfo());
            setStatus('conectado');
            shouldStopRef.current = false;
            if (!loopRunningRef.current) iniciarLeituraContinua();
            return true;
          }
          throw e;
        }
      }
    } catch (e) {
      // Continua para requestPort
    }

    // Sem portas autorizadas — pede seleção ao usuário
    return conectar();
  }, [pararLeitura, iniciarLeituraContinua, conectar]);

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

  /**
   * Conecta a balança abrindo a porta UMA ÚNICA VEZ na taxa salva.
   * NÃO faz ciclo de baud rates — fechar/reabrir a porta interrompe o fluxo de dados
   * do adaptador USB-serial (a luz do adaptador para de piscar).
   * Se a porta já está aberta (auto-conexão), apenas reutiliza — nunca fecha.
   */
  const conectarComAutoDeteccao = useCallback(async () => {
    if (!('serial' in navigator)) {
      setSuportado(false);
      setStatus('nao_suportado');
      return false;
    }
    setErro(null);

    // Se a porta já está aberta e conectada, NÃO fecha — apenas garante leitura ativa
    if (portRef.current && portRef.current.readable) {
      if (!loopRunningRef.current && !readerRef.current) {
        shouldStopRef.current = false;
        iniciarLeituraContinua();
      }
      setStatus('conectado');
      return true;
    }

    setStatus('conectando');
    try {
      const port = await navigator.serial.requestPort();

      // Abre UMA VEZ na taxa salva — sem ciclar entre baud rates
      await port.open({
        baudRate: baudRateRef.current,
        dataBits: dataBitsRef.current,
        stopBits: stopBitsRef.current,
        parity: parityRef.current,
      });
      portRef.current = port;
      setPortaInfo(port.getInfo());
      shouldStopRef.current = false;
      ultimaLeituraRef.current = null;
      dadosRecebidosRef.current = false;
      rawDataRef.current = '';
      setUltimaLeitura(null);
      setRawData('');
      setStatus('conectado');
      iniciarLeituraContinua();
      return true;
    } catch (e) {
      if (e.name === 'NotFoundError' || e.name === 'AbortError') {
        // Usuário cancelou a seleção de porta
        setStatus('desconectado');
      } else if (e.name === 'InvalidStateError') {
        // A porta já estava aberta — usa ela
        setStatus('conectado');
        if (!loopRunningRef.current) {
          shouldStopRef.current = false;
          iniciarLeituraContinua();
        }
        return true;
      } else if (e.name === 'SecurityError') {
        setStatus('erro');
        setErro('Acesso negado pelo navegador. Use Chrome ou Edge em desktop via HTTPS.');
      } else if (e.name === 'NotSupportedError') {
        setStatus('erro');
        setErro('Combinação de parâmetros não suportada pelo adaptador. Tente 8 data bits, 1 stop bit, parity none.');
      } else if (e.name === 'NetworkError') {
        setStatus('erro');
        setErro('A porta está ocupada por outro programa. Feche qualquer outro software de balança e tente novamente.');
      } else {
        setStatus('erro');
        setErro(`Erro ao abrir porta: ${e.message || e}`);
      }
      return false;
    }
  }, [iniciarLeituraContinua]);

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
    conectarComAutoDeteccao,
    reconectar,
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