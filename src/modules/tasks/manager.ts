/**
 * ZARA AI 2070 — Task Manager.
 *
 * A simple, persistent task/reminder system for Aitzaz's personal
 * productivity. Tasks persist across app restarts via localStorage.
 */

import { createPersistedStore } from '../storage/local'

export type TaskPriority = 'low' | 'normal' | 'high'
export type TaskStatus = 'pending' | 'in_progress' | 'done'

export interface ZaraTask {
  id: string
  title: string
  notes?: string
  priority: TaskPriority
  status: TaskStatus
  due?: string // ISO date
  createdAt: string
  completedAt?: string
}

export interface TaskManager {
  all(): ZaraTask[]
  pending(): ZaraTask[]
  add(task: Omit<ZaraTask, 'id' | 'status' | 'createdAt'>): ZaraTask
  update(id: string, patch: Partial<Omit<ZaraTask, 'id'>>): ZaraTask | undefined
  complete(id: string): ZaraTask | undefined
  remove(id: string): boolean
  clear(): void
  dueToday(): ZaraTask[]
}

const STORE_KEY = 'zara.tasks.v1'

function todayISO(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function makeId(): string {
  return `task-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function createTaskManager(): TaskManager {
  const store = createPersistedStore<ZaraTask[]>(STORE_KEY, [])
  let tasks = store.load()

  function persist(): void {
    store.save(tasks)
  }

  return {
    all(): ZaraTask[] {
      return [...tasks]
    },
    pending(): ZaraTask[] {
      return tasks
        .filter(t => t.status !== 'done')
        .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    },
    add(task): ZaraTask {
      const entry: ZaraTask = {
        ...task,
        id: makeId(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      tasks = [entry, ...tasks]
      persist()
      return entry
    },
    update(id, patch): ZaraTask | undefined {
      const idx = tasks.findIndex(t => t.id === id)
      if (idx === -1) return undefined
      tasks[idx] = { ...tasks[idx], ...patch }
      persist()
      return tasks[idx]
    },
    complete(id): ZaraTask | undefined {
      const t = tasks.find(t => t.id === id)
      if (!t) return undefined
      t.status = 'done'
      t.completedAt = new Date().toISOString()
      persist()
      return t
    },
    remove(id): boolean {
      const before = tasks.length
      tasks = tasks.filter(t => t.id !== id)
      const removed = tasks.length < before
      if (removed) persist()
      return removed
    },
    clear(): void {
      tasks = []
      persist()
    },
    dueToday(): ZaraTask[] {
      const today = todayISO()
      return tasks.filter(
        t => t.due === today && t.status !== 'done'
      )
    },
  }
}

function priorityRank(p: TaskPriority): number {
  if (p === 'high') return 3
  if (p === 'normal') return 2
  return 1
}
