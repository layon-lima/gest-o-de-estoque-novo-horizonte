// Wrappers offline-aware para operações de entidade (create/update).
// Quando online: executa normalmente. Quando offline: enfileira + atualização otimista.
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { isOnline, enqueue, genId, emitChange, isNetworkError } from '@/lib/offlineCore';

export async function offlineCreate(entityName, data) {
  if (isOnline()) {
    try {
      return await base44.entities[entityName].create(data);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Erro de rede mesmo "online" — cai para fila
    }
  }
  // Offline: enfileira + atualização otimista
  const opId = genId();
  const tempRecord = {
    ...data,
    id: 'pending-' + opId,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    _pending: true,
  };
  await enqueue({ id: opId, type: 'create', entity: entityName, data, timestamp: Date.now() });
  queryClientInstance.setQueriesData(
    { queryKey: ['ent', entityName] },
    (old) => (old ? [tempRecord, ...old] : [tempRecord])
  );
  return tempRecord;
}

export async function offlineUpdate(entityName, id, data) {
  if (isOnline()) {
    try {
      return await base44.entities[entityName].update(id, data);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  // Offline: enfileera + atualização otimista
  const opId = genId();
  await enqueue({ id: opId, type: 'update', entity: entityName, recordId: id, data, timestamp: Date.now() });
  queryClientInstance.setQueriesData(
    { queryKey: ['ent', entityName] },
    (old) => {
      if (!old) return old;
      return old.map((r) => (r.id === id ? { ...r, ...data, _pending: true } : r));
    }
  );
  return { ...data, id, _pending: true };
}