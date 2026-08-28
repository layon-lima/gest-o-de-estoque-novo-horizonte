// Operações de entidade resilientes a registros fantasmas (restos do cache offline).
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { invalidateEntidade } from '@/lib/useEntidades';

// Verifica se um erro é "entidade não encontrada" (registro fantasma do cache).
export function isNotFoundError(err) {
  return /not found/i.test(String(err?.message || err || ''));
}

// Remove o registro do cache do React Query imediatamente (update otimista)
// para a UI não continuar exibindo o registro excluído durante o refetch.
function removeFromCache(entityName, id) {
  queryClientInstance.setQueriesData({ queryKey: ['ent', entityName] }, (old) =>
    (old || []).filter((r) => r.id !== id)
  );
}

// Exclui uma entidade com tolerância a registros fantasmas (not found).
// Remove o registro do cache imediatamente e invalida para refetch.
// Lança qualquer outro erro (permissão, rede, etc.) para o caller tratar.
export async function safeDelete(entityName, id) {
  try {
    await base44.entities[entityName].delete(id);
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
    // Registro fantasma: já não existe no backend. Trata como sucesso.
  }
  removeFromCache(entityName, id);
  invalidateEntidade(entityName);
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
      invalidateEntidade(entityName);
      throw new Error('PHANTOM_RECORD');
    }
    throw err;
  }
}