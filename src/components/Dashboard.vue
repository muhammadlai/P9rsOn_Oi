<template>
  <div class="dashboard p-4 text-white h-full overflow-y-auto">
    <!-- Identity -->
    <div class="mb-4 p-3 rounded-lg bg-gradient-to-r from-cyan-900/40 to-indigo-900/40 border border-cyan-500/30">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-bold text-cyan-300">
            {{ identity.assistant }} {{ identity.version }}
          </div>
          <div class="text-sm text-gray-300">{{ identity.role }}</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-gray-400">OWNER</div>
          <div class="text-lg font-semibold">{{ identity.owner }}</div>
        </div>
      </div>
    </div>

    <!-- System status -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-gray-300 mb-2">System Status</h3>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="s in systemStatus"
          :key="s.key"
          class="flex items-center gap-2 p-2 rounded bg-gray-800/60"
          :title="s.detail"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="statusDot[s.status]"
          ></span>
          <span class="text-xs text-gray-200">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <!-- Today -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-gray-300 mb-2">Today</h3>
      <div v-if="dueTasks.length === 0" class="text-xs text-gray-500 p-2 bg-gray-800/40 rounded">
        No tasks due today.
      </div>
      <div v-else class="space-y-1">
        <div v-for="t in dueTasks" :key="t.id" class="text-xs p-2 bg-gray-800/60 rounded flex justify-between">
          <span>{{ t.title }}</span>
          <span :class="priorityColor[t.priority]">{{ t.priority }}</span>
        </div>
      </div>
    </div>

    <!-- Agents -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-gray-300 mb-2">
        Agents ({{ readyAgentCount }}/{{ agents.length }} ready)
      </h3>
      <div class="space-y-1">
        <div
          v-for="a in agents"
          :key="a.id"
          class="p-2 rounded bg-gray-800/60"
        >
          <div class="flex justify-between items-center">
            <span class="text-xs font-medium">{{ a.name }}</span>
            <span class="text-[10px] px-1.5 rounded" :class="agentState[a.readyState]">
              {{ a.readyState }}
            </span>
          </div>
          <div class="text-[10px] text-gray-500">{{ a.description }}</div>
          <div v-if="a.readyState !== 'ready'" class="text-[10px] text-amber-400/80 mt-0.5">
            {{ a.readinessNote }}
          </div>
        </div>
      </div>
    </div>

    <!-- Tasks -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-gray-300 mb-2">Tasks</h3>
      <div v-if="tasks.length === 0" class="text-xs text-gray-500 p-2 bg-gray-800/40 rounded">
        No tasks. Ask ZARA: "Add a task" or manage below.
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="t in pendingTasks"
          :key="t.id"
          class="text-xs p-2 bg-gray-800/60 rounded flex justify-between items-center"
        >
          <span :class="{ 'line-through text-gray-500': t.status === 'done' }">
            {{ t.title }}
          </span>
          <div class="flex gap-1">
            <button
              v-if="t.status !== 'done'"
              class="btn btn-xs btn-success"
              @click="completeTask(t.id)"
            >Done</button>
            <button class="btn btn-xs btn-ghost" @click="removeTask(t.id)">✕</button>
          </div>
        </div>
      </div>
      <div class="flex gap-1 mt-2">
        <input
          v-model="newTaskTitle"
          class="input input-xs bg-gray-800 text-white flex-1"
          placeholder="New task"
          @keyup.enter="addTask"
        />
        <button class="btn btn-xs btn-primary" @click="addTask">Add</button>
      </div>
    </div>

    <!-- Clients / CRM -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-gray-300 mb-2">Clients / Leads</h3>
      <div v-if="leads.length === 0" class="text-xs text-gray-500 p-2 bg-gray-800/40 rounded">
        No leads tracked. Ask ZARA to find clients or add leads below.
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="l in leads"
          :key="l.id"
          class="text-xs p-2 bg-gray-800/60 rounded flex justify-between items-center"
        >
          <div>
            <div class="font-medium">{{ l.company || l.contact || 'Lead' }}</div>
            <div class="text-gray-500 text-[10px]">{{ l.service }}</div>
          </div>
          <span class="text-[10px] px-1.5 rounded" :class="leadState[l.status]">
            {{ l.status }}
          </span>
        </div>
      </div>
    </div>

    <!-- Activity log -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-gray-300 mb-2">Activity</h3>
      <div v-if="activityEntries.length === 0" class="text-xs text-gray-500 p-2 bg-gray-800/40 rounded">
        No activity recorded yet.
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="e in activityEntries.slice(0, 20)"
          :key="e.id"
          class="text-[10px] p-2 bg-gray-800/40 rounded"
        >
          <div class="text-gray-400">{{ e.time }} · {{ e.tool || e.intent }}</div>
          <div class="text-gray-200">{{ e.userCommand }}</div>
          <div :class="resultColor[e.result]">{{ e.result }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useZaraStore } from '../stores/zaraStore'
import { defaultSystemStatus } from '../modules/identity'

const zara = useZaraStore()
const identity = computed(() => zara.identity)
const agents = computed(() => zara.agents)
const readyAgentCount = computed(() => zara.readyAgentCount)
const tasks = computed(() => zara.tasks)
const pendingTasks = computed(() => zara.taskManager.pending())
const dueTasks = computed(() => zara.taskManager.dueToday())
const leads = computed(() => zara.leads)
const activityEntries = computed(() => zara.activityEntries)

const systemStatus = defaultSystemStatus()

const newTaskTitle = ref('')

const statusDot: Record<string, string> = {
  online: 'bg-green-400',
  offline: 'bg-gray-500',
  'not-configured': 'bg-amber-400',
  limited: 'bg-blue-400',
}

const agentState: Record<string, string> = {
  ready: 'bg-green-500/20 text-green-300',
  'requires-config': 'bg-amber-500/20 text-amber-300',
  unavailable: 'bg-red-500/20 text-red-300',
}

const priorityColor: Record<string, string> = {
  low: 'text-gray-400',
  normal: 'text-blue-300',
  high: 'text-red-300',
}

const leadState: Record<string, string> = {
  NEW: 'bg-blue-500/20 text-blue-300',
  CONTACTED: 'bg-cyan-500/20 text-cyan-300',
  REPLIED: 'bg-indigo-500/20 text-indigo-300',
  NEGOTIATING: 'bg-purple-500/20 text-purple-300',
  WON: 'bg-green-500/20 text-green-300',
  LOST: 'bg-gray-500/20 text-gray-400',
  FOLLOW_UP: 'bg-amber-500/20 text-amber-300',
}

const resultColor: Record<string, string> = {
  SUCCESS: 'text-green-300',
  FAILED: 'text-red-300',
  PERMISSION_REQUIRED: 'text-amber-300',
  NOT_CONNECTED: 'text-gray-400',
  UNSUPPORTED: 'text-gray-400',
}

function addTask() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  zara.taskManager.add({ title, priority: 'normal' })
  zara.refreshTasks()
  newTaskTitle.value = ''
}

function completeTask(id: string) {
  zara.taskManager.complete(id)
  zara.refreshTasks()
}

function removeTask(id: string) {
  zara.taskManager.remove(id)
  zara.refreshTasks()
}
</script>
