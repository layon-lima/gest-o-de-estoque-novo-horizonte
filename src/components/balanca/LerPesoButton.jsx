import { Scale, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBalanca } from '@/lib/balancaContext';
import { useToast } from '@/components/ui/use-toast';

export default function LerPesoButton({ onPesoLido, className }) {
  const { suportado, status, lendo, lerPeso, formatarPeso, conectarComAutoDeteccao } = useBalanca();
  const { toast } = useToast();

  async function handleClick() {
    if (!suportado) {
      toast({
        variant: 'destructive',
        title: 'Navegador não suportado',
        description: 'Use o Microsoft Edge ou Google Chrome no desktop para ler o peso da balança.',
      });
      return;
    }

    // Se a balança não está conectada, conecta com auto-detecção de baud rate
    if (status !== 'conectado') {
      toast({
        title: 'Conectando balança...',
        description: 'Selecione a porta USB da balança na janela que abriu.',
      });
      const ok = await conectarComAutoDeteccao();
      if (!ok) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível ler',
          description: 'A balança não enviou dados. Verifique se o driver USB do conversor serial está instalado neste PC e se o cabo está firme.',
        });
        return;
      }
    }

    const peso = await lerPeso();
    if (peso !== null && peso !== undefined) {
      const formatado = formatarPeso(peso);
      onPesoLido?.(formatado);
      toast({ title: 'Peso lido da balança', description: `${formatado} kg` });
    } else {
      toast({
        variant: 'destructive',
        title: 'Falha na leitura',
        description: 'Verifique se a balança está ligada e enviando dados.',
      });
    }
  }

  return (
    <Button
      type="button"
      variant="default"
      size="lg"
      onClick={handleClick}
      disabled={lendo}
      className={`shrink-0 gap-2 ${className || ''}`}
    >
      {lendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scale className="w-5 h-5" />}
      {lendo ? 'Lendo...' : 'Ler Peso'}
    </Button>
  );
}