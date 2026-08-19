import { useEffect, useRef, useState } from 'react';
import { X, ScanLine, Camera, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Leitor de QR Code via câmera (mobile). Usa html5-qrcode.
// onScan(decodedText) é chamado quando um QR é lido com sucesso.
export default function QrScanner({ open, onClose, onScan }) {
  const regionId = 'qr-reader-region';
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let mounted = true;
    let html5;
    let timeoutRef;

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        // Timeout de segurança: se a câmera não iniciar em 8s, libera a tela.
        timeoutRef = setTimeout(() => {
          if (mounted && starting) {
            setError('A câmera demorou para responder. Verifique as permissões do navegador ou use a seleção manual.');
            setStarting(false);
          }
        }, 8000);

        // Seleciona uma câmera real explicitamente (evita travar com facingMode).
        let cameras = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch (_) {
          cameras = [];
        }
        if (!mounted) return;

        html5 = new Html5Qrcode(regionId, { verbose: false });
        scannerRef.current = html5;

        const back = cameras.find((c) => /back|rear|environment|traseira/i.test(c.label || ''));
        const camId = back?.id || cameras[0]?.id;

        const config = { fps: 10, qrbox: { width: 220, height: 220 } };
        const facing = camId ? { deviceId: { exact: camId } } : { facingMode: 'environment' };

        await html5.start(
          facing,
          config,
          (decodedText) => {
            if (!mounted) return;
            html5.stop().catch(() => {}).finally(() => {
              if (mounted) onScan(decodedText);
            });
          },
          () => {}
        );
        if (mounted) {
          clearTimeout(timeoutRef);
          setStarting(false);
        }
      } catch (e) {
        if (mounted) {
          clearTimeout(timeoutRef);
          setError('Não foi possível acessar a câmera. Verifique as permissões do navegador ou use a seleção manual.');
          setStarting(false);
        }
      }
    }

    if (open) start();
    return () => {
      mounted = false;
      if (timeoutRef) clearTimeout(timeoutRef);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-2 font-medium">
          <ScanLine className="w-5 h-5" />
          Escanear QR Code da Máquina
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {error ? (
          <div className="text-center text-white max-w-sm space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-400" />
            <p className="text-sm">{error}</p>
            <Button variant="secondary" onClick={onClose}>Usar seleção manual</Button>
          </div>
        ) : (
          <>
            <div
              id={regionId}
              className="w-full max-w-sm h-[60vh] max-h-[420px] overflow-hidden rounded-xl bg-black flex items-center justify-center"
            >
              {starting && (
                <div className="flex flex-col items-center gap-2 text-white/80 text-sm">
                  <Camera className="w-6 h-6 animate-pulse" />
                  Iniciando câmera…
                </div>
              )}
            </div>
            {!starting && (
              <p className="mt-4 text-white/70 text-sm text-center max-w-xs">
                Aponte a câmera para o QR Code colado na máquina.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}