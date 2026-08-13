/**
 * ZARA — activity log.
 *
 * A transparent, user-visible record of what was said, what intent was routed
 * and what actually happened. Entries are redacted before storage so no secret
 * can ever reach the log.
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ActionStatus, ZaraIntent } from '../zara/types'

export type ActivityActor = 'OWNER' | 'ZARA' | 'SYSTEM' | 'BROWSER' | 'COMPUTER'

export interface ActivityEntry {
  id: string
  timestamp: number
  actor: ActivityActor
  /** Short label, e.g. "Open YouTube" or "OPEN_WEBSITE". */
  label: string
  intent?: ZaraIntent
  status?: ActionStatus
  detail?: string
}

const MAX_ENTRIES = 500
const STORAGE_KEY = 'zara.activityLog.v1'

/**
 * Strips anything that looks like a credential. Defence in depth — the log
 * should never receive a key in the first place.
 */
export function redact(text: string): string {
  if (!text) return ''
  return text
    .replace(/\b(sk|gsk|pk|rk)-[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(
      /\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*\S+/gi,
      '$1=[redacted]'
    )
    .slice(0, 500)
}

export const useActivityStore = defineStore('activity', () => {
  const entries = ref<ActivityEntry[]>([])

  const load = () => {
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) entries.value = JSON.parse(raw)
    } catch {
      entries.value = []
    }
  }

  const persist = () => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(entries.value.slice(0, MAX_ENTRIES))
      )
    } catch {
      /* storage full or unavailable — the log is non-critical */
    }
  }

  const log = (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
    entries.value.unshift({
      ...entry,
      label: redact(entry.label),
      detail: entry.detail ? redact(entry.detail) : undefined,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    })
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES)
    }
    persist()
  }

  const logOwner = (utterance: string) =>
    log({ actor: 'OWNER', label: utterance })

  const logIntent = (intent: ZaraIntent) =>
    log({ actor: 'ZARA', label: intent, intent })

  const logResult = (
    actor: ActivityActor,
    status: ActionStatus,
    detail?: string
  ) => log({ actor, label: status, status, detail })

  const clear = () => {
    entries.value = []
    persist()
  }

  const successCount = computed(
    () => entries.value.filter(e => e.status === 'SUCCESS').length
  )
  const failureCount = computed(
    () =>
      entries.value.filter(
        e =>
          e.status &&
          e.status !== 'SUCCESS' &&
          e.status !== 'CONFIRMATION_REQUIRED'
      ).length
  )

  load()

  return {
    entries,
    log,
    logOwner,
    logIntent,
    logResult,
    clear,
    successCount,
    failureCount,
  }
})
