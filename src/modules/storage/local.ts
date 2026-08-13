/**
 * Small persistent local store backed by localStorage. Survives app restarts.
 * Used by the task and client/CRM stores so Aitzaz's data persists.
 */

export interface PersistedStore<T> {
  load(): T
  save(value: T): void
  clear(): void
}

export function createPersistedStore<T>(
  key: string,
  fallback: T
): PersistedStore<T> {
  function isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage
  }

  return {
    load(): T {
      if (!isAvailable()) return fallback
      try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return fallback
        return JSON.parse(raw) as T
      } catch {
        return fallback
      }
    },
    save(value: T): void {
      if (!isAvailable()) return
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        /* storage full/unavailable — ignore, in-memory still works */
      }
    },
    clear(): void {
      if (!isAvailable()) return
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}
