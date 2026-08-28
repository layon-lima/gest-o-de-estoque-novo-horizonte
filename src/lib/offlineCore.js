// Núcleo do sistema offline: fila de operações, cache de entidades,
// detecção online/offline e sistema de eventos.
import { dbPut, dbGet, dbGetAll, dbDelete, dbCount } from '@/lib/offlineDB';

// --- Eventos ---
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emitChange() { listeners.forEach((fn) => fn()); }

// --- Utilitários ---
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
}

export function isNetworkError(e) {
  if (e instanceof TypeError) return true;
  const msg = String(e?.message || e).toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('failed to') || msg.includes('err_internet') || msg.includes('load failed');
}

// --- Fila de operações pendentes ---
export async function enqueue(op) {
  try {
    await dbPut('pending_ops', op);
    emitChange();
  } catch (e) {
    // Se IndexedDB falhar, não derruba o app
  }
}

export async function getPendingOps() {
  try { return await dbGetAll('pending_ops'); } catch { return []; }
}

export async function removeOp(id) {
  try {
    await dbDelete('pending_ops', id);
    emitChange();
  } catch {}
}

export async function getPendingCount() {
  try { return await dbCount('pending_ops'); } catch { return 0; }
}

// Retorna registros temporários para creates pendentes (para exibição otimista nas listas).
export async function getPendingCreates(entityName) {
  try {
    const ops = await dbGetAll('pending_ops');
    return ops
      .filter((op) => op.type === 'create' && op.entity === entityName)
      .map((op) => ({
        ...op.data,
        id: 'pending-' + op.id,
        created_date: new Date(op.timestamp).toISOString(),
        _pending: true,
      }));
  } catch { return []; }
}

// --- Cache de entidades para leitura offline ---
export async function cacheEntityList(name, data) {
  try { await dbPut('entity_cache', { key: name, data, timestamp: Date.now() }); } catch {}
}

export async function getCachedEntityList(name) {
  try {
    const result = await dbGet('entity_cache', name);
    return result?.data || null;
  } catch { return null; }
}