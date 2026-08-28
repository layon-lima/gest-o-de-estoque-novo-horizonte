// Indicador visual de status offline/sincronização. Non-intrusivo.
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OfflineBadge() {
  const { isOnline, pendingCount, syncing } = useOnlineStatus();

  if (syncing) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Sincronizando</span>
        {pendingCount > 0 && <span className="bg-blue-100 px-1.5 rounded-full">{pendingCount}</span>}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sem conexão</span>
        {pendingCount > 0 && <span className="bg-amber-100 px-1.5 rounded-full">{pendingCount}</span>}
      </div>
    );
  }

  return null;
}