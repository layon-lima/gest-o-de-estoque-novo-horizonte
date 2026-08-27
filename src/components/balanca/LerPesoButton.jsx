import { Scale, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBalanca } from '@/lib/balancaContext';
import { useToast } from '@/components/ui/use-toast';

export default function LerPesoButton({ onPesoLido, className }) {
  const { suportado, status, lendo, lerPeso, formatarPeso } = useBalanca();
  const { toast } = useToast();

  async function handleClick() {
    if (!suportado) {
      toast({
        variant: 'destructive',
        title: 'Navegador não suportado',
        description: 'Use o Microsoft Edge ou Google Chrome para ler o peso da balança.',
      });
      return;
    }
    if (status !== 'conectado') {
      toast({
        variant: 'destructive',
        title: 'Balança desconectada',
        description: 'Vá em Menu › Balança para conectar a balança antes de ler o peso.',
      });
      return;
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
        description: 'Não foi possível ler o peso. Verifique a balança na página Balança.',
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