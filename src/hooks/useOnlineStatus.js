// Hook reativo: status online/offline + contagem de pendentes + sincronização automática.
import { useState, useEffect } from 'react';
import { getPendingCount, subscribe, isOnline } from '@/lib/offlineCore';
import { flushQueue, isFlushing } from '@/lib/offlineSync';

export function useOnlineStatus() {
  const [state, setState] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    syncing: false,
  });

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      if (!mounted) return;
      const count = await getPendingCount();
      if (!mounted) return;
      setState({
        isOnline: navigator.onLine,
        pendingCount: count,
        syncing: isFlushing(),
      });
    }

    async function handleOnline() {
      await refresh();
      const count = await getPendingCount();
      if (count > 0 && !isFlushing()) {
        flushQueue().then(() => refresh());
      }
    }

    function handleOffline() { refresh(); }

    refresh();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsub = subscribe(refresh);

    // No montagem: se online e há pendentes, sincroniza
    if (isOnline() && !isFlushing()) {
      getPendingCount().then((count) => {
        if (count > 0) flushQueue().then(() => refresh());
      });
    }

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  return state;
}