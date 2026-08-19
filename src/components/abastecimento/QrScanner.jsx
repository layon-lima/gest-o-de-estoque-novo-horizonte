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

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;
        html5 = new Html5Qrcode(regionId);
        scannerRef.current = html5;
        await html5.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decodedText) => {
            if (!mounted) return;
            html5.stop().catch(() => {}).finally(() => {
              onScan(decodedText);
            });
          },
          () => {}
        );
        if (mounted) setStarting(false);
      } catch (e) {
        if (mounted) {
          setError('Não foi possível acessar a câmera. Verifique as permissões do navegador ou use a seleção manual.');
          setStarting(false);
        }
      }
    }

    if (open) start();
    return () => {
      mounted = false;
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
            <div id={regionId} className="w-full max-w-sm overflow-hidden rounded-xl" />
            {starting && (
              <div className="mt-4 flex items-center gap-2 text-white/80 text-sm">
                <Camera className="w-4 h-4 animate-pulse" />
                Iniciando câmera…
              </div>
            )}
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