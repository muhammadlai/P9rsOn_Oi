/**
 * ZARA AI 2070 — Client/Lead CRM.
 *
 * A simple, persistent lead & client tracker. Statuses follow the spec
 * (NEW, CONTACTED, REPLIED, NEGOTIATING, WON, LOST, FOLLOW_UP).
 */

import { createPersistedStore } from '../storage/local'

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'REPLIED'
  | 'NEGOTIATING'
  | 'WON'
  | 'LOST'
  | 'FOLLOW_UP'

export const LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'REPLIED',
  'NEGOTIATING',
  'WON',
  'LOST',
  'FOLLOW_UP',
]

export interface Lead {
  id: string
  company?: string
  contact?: string
  service?: string
  status: LeadStatus
  lastContact?: string
  nextFollowUp?: string
  notes?: string
  createdAt: string
}

export interface ClientManager {
  all(): Lead[]
  byStatus(status: LeadStatus): Lead[]
  add(lead: Omit<Lead, 'id' | 'status' | 'createdAt'> & { status?: LeadStatus }): Lead
  update(id: string, patch: Partial<Omit<Lead, 'id'>>): Lead | undefined
  remove(id: string): boolean
  clear(): void
  followUpsDue(today?: string): Lead[]
}

const STORE_KEY = 'zara.clients.v1'

function makeId(): string {
  return `lead-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function todayISO(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function createClientManager(): ClientManager {
  const store = createPersistedStore<Lead[]>(STORE_KEY, [])
  let leads = store.load()

  function persist(): void {
    store.save(leads)
  }

  return {
    all(): Lead[] {
      return [...leads]
    },
    byStatus(status): Lead[] {
      return leads.filter(l => l.status === status)
    },
    add(lead): Lead {
      const entry: Lead = {
        ...lead,
        status: lead.status ?? 'NEW',
        id: makeId(),
        createdAt: new Date().toISOString(),
      }
      leads = [entry, ...leads]
      persist()
      return entry
    },
    update(id, patch): Lead | undefined {
      const idx = leads.findIndex(l => l.id === id)
      if (idx === -1) return undefined
      leads[idx] = { ...leads[idx], ...patch }
      persist()
      return leads[idx]
    },
    remove(id): boolean {
      const before = leads.length
      leads = leads.filter(l => l.id !== id)
      const removed = leads.length < before
      if (removed) persist()
      return removed
    },
    clear(): void {
      leads = []
      persist()
    },
    followUpsDue(today = todayISO()): Lead[] {
      return leads.filter(
        l => l.nextFollowUp === today && l.status !== 'WON' && l.status !== 'LOST'
      )
    },
  }
}
