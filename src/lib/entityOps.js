// Operações de entidade resilientes a registros fantasmas (restos do cache offline).
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';

// Verifica se um erro é "entidade não encontrada" (registro fantasma do cache).
export function isNotFoundError(err) {
  return /not found/i.test(String(err?.message || err || ''));
}

// Remove o registro do cache do React Query imediatamente (update otimista)
// para a UI não continuar exibindo o registro excluído durante o refetch.
// Usa removeQueries ( Nuclear option) para garantir que o cache seja limpo.
function removeFromCache(entityName, id) {
  // 1. Update otimista: remove o registro das listas em cache (feedback imediato)
  queryClientInstance.setQueriesData({ queryKey: ['ent', entityName] }, (old) =>
    Array.isArray(old) ? old.filter((r) => r.id !== id) : old
  );
  // 2. Remove completamente as queries desta entidade do cache.
  //    Isto força o useQueries a refazer a busca do zero no backend,
  //    eliminando qualquer registro fantasma que o setQueriesData possa ter perdido.
  queryClientInstance.removeQueries({ queryKey: ['ent', entityName] });
}

// Exclui uma entidade com tolerância a registros fantasmas (not found).
// Remove o registro do cache imediatamente e força refetch do backend.
// Lança qualquer outro erro (permissão, rede, etc.) para o caller tratar.
export async function safeDelete(entityName, id) {
  try {
    await base44.entities[entityName].delete(id);
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
    // Registro fantasma: já não existe no backend. Trata como sucesso.
  }
  removeFromCache(entityName, id);
  // Força uma nova busca no backend (não usa cache stale)
  queryClientInstance.refetchQueries({ queryKey: ['ent', entityName] });
}

// Atualiza uma entidade com tolerância a registros fantasmas (not found).
// Se o registro não existe, remove do cache e lança 'PHANTOM_RECORD'
// para o caller decidir como tratar (geralmente: fechar formulário e recarregar).
export async function safeUpdate(entityName, id, data) {
  try {
    return await base44.entities[entityName].update(id, data);
  } catch (err) {
    if (isNotFoundError(err)) {
      removeFromCache(entityName, id);
      queryClientInstance.refetchQueries({ queryKey: ['ent', entityName] });
      throw new Error('PHANTOM_RECORD');
    }
    throw err;
  }
}