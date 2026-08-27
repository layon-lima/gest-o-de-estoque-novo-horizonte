import { Link } from 'react-router-dom';
import { useBalanca } from '@/lib/balancaContext';

export default function BalancaStatusBadge() {
  const { suportado, status } = useBalanca();

  const dotClass = !suportado
    ? 'bg-gray-400'
    : status === 'conectado'
    ? 'bg-green-500'
    : status === 'conectando'
    ? 'bg-amber-500 animate-pulse'
    : 'bg-red-500';

  const label = !suportado
    ? 'Balança não suportada'
    : status === 'conectado'
    ? 'Balança Conectada'
    : status === 'conectando'
    ? 'Conectando...'
    : status === 'erro'
    ? 'Erro na balança'
    : 'Balança Desconectada';

  return (
    <Link
      to="/balanca"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill text-xs font-medium hover:bg-foreground/10 transition-colors"
    >
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      {label}
    </Link>
  );
}