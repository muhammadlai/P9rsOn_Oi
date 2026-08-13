/**
 * ZARA AI 2070 — central store for the agent system, tasks, CRM and activity.
 * Wires the pure foundation modules into reactive Pinia state.
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { ZARA_IDENTITY } from '../modules/identity'
import {
  listAgents,
  listReadyAgents,
  routeIntent,
  type AgentId,
} from '../modules/agents/registry'
import { PermissionEngine } from '../modules/permissions/engine'
import {
  activityLog,
  type ActivityEntry,
  type ActivityLog,
} from '../modules/activity/log'
import { createTaskManager, type ZaraTask } from '../modules/tasks/manager'
import { createClientManager, type Lead } from '../modules/crm/manager'

export const useZaraStore = defineStore('zara', () => {
  const identity = ref(ZARA_IDENTITY)

  // Agents
  const agents = ref(listAgents())
  const readyAgentCount = ref(listReadyAgents().length)

  // Permission engine
  const permissionEngine = new PermissionEngine()

  // Activity log (non-reactive snapshot, and a reactive mirror)
  const log: ActivityLog = activityLog
  const activityEntries = ref<ActivityEntry[]>(log.all())

  // Tasks
  const taskManager = createTaskManager()
  const tasks = ref<ZaraTask[]>(taskManager.all())

  // Clients / CRM
  const clientManager = createClientManager()
  const leads = ref<Lead[]>(clientManager.all())

  function recordActivity(entry: Omit<ActivityEntry, 'id' | 'time'>): void {
    log.add(entry)
    activityEntries.value = log.all()
  }

  function refreshTasks(): void {
    tasks.value = taskManager.all()
  }

  function refreshLeads(): void {
    leads.value = clientManager.all()
  }

  return {
    identity,
    agents,
    readyAgentCount,
    permissionEngine,
    log,
    activityEntries,
    taskManager,
    tasks,
    clientManager,
    leads,
    recordActivity,
    refreshTasks,
    refreshLeads,
    routeIntent: (input: string) => routeIntent(input),
    classifyAction: (action: string) => permissionEngine.request(action, ''),
  }
})
