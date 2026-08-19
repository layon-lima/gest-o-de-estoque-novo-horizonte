import { QRCodeSVG } from 'qrcode.react';
import { Printer, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Cartão de QR Code da máquina, com botão de impressão em etiqueta.
// O QR codifica o id da máquina — o leitor do app localiza a máquina por esse id.
export default function FuelQrCard({ maquina, open, onClose }) {
  if (!maquina) return null;
  const valor = maquina.id;

  function handlePrint() {
    const svgEl = document.getElementById('fuel-qr-svg');
    const svgStr = svgEl ? new XMLSerializer().serializeToString(svgEl) : '';
    const w = window.open('', '_blank', 'width=420,height=620');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR Code — ${maquina.nome}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, sans-serif; display: flex; justify-content: center; padding: 24px; }
        .card { border: 2px dashed #94a3b8; border-radius: 12px; padding: 24px; text-align: center; width: 320px; }
        .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        .code { font-size: 13px; color: #475569; margin-bottom: 16px; font-family: monospace; }
        .qr { display: flex; justify-content: center; margin-bottom: 16px; }
        .hint { font-size: 11px; color: #64748b; }
      </style></head>
      <body>
        <div class="card">
          <div class="title">${maquina.nome || ''}</div>
          <div class="code">${maquina.codigo || ''}</div>
          <div class="qr">${svgStr}</div>
          <div class="hint">Aponte a câmera do app para este QR Code<br>para registrar o abastecimento.</div>
        </div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            QR Code da Máquina
          </DialogTitle>
          <DialogDescription>
            Imprima esta etiqueta e cole na máquina. O operador lê o QR no app para iniciar o abastecimento.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="font-semibold text-center">{maquina.nome}</div>
          <div className="text-xs font-mono text-muted-foreground">{maquina.codigo}</div>
          <div className="p-3 bg-white rounded-lg border">
            <QRCodeSVG id="fuel-qr-svg" value={valor} size={180} level="M" />
          </div>
        </div>
        <Button onClick={handlePrint} className="w-full">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir etiqueta
        </Button>
      </DialogContent>
    </Dialog>
  );
}