<template>
  <div class="zara-tab space-y-6">
    <!-- Profile ------------------------------------------------------->
    <section class="panel">
      <h3 class="panel-title">Profile</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="field-label">Assistant Name</label>
          <input class="field-input" :value="ASSISTANT_NAME" readonly />
        </div>
        <div>
          <label class="field-label">Owner Name</label>
          <input class="field-input" :value="OWNER_NAME" readonly />
        </div>
      </div>
      <p class="field-hint">
        ZARA is configured as {{ OWNER_NAME_DISPLAY }}'s personal assistant.
      </p>
    </section>

    <!-- API configuration --------------------------------------------->
    <section class="panel">
      <h3 class="panel-title">API Configuration</h3>

      <div class="status-row">
        <span class="field-label mb-0">Connection Status</span>
        <span class="status-pill" :class="statusPillClass">
          {{ statusText }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label class="field-label">AI Provider</label>
          <input class="field-input" :value="config.provider || '—'" readonly />
        </div>
        <div>
          <label class="field-label">Model</label>
          <input class="field-input" :value="config.model || '—'" readonly />
        </div>
      </div>

      <div class="mt-4">
        <label class="field-label">API Key</label>
        <input
          class="field-input font-mono"
          :value="config.maskedKey || 'Not configured'"
          readonly
          aria-label="API key (masked)"
        />
        <p class="field-hint">
          <template v-if="config.hasApiKey">
            A key is configured
            <template v-if="config.source === 'env'">
              via the <code>.env</code> file</template
            ><template v-else> in encrypted storage</template>. The full key is
            never displayed, logged, or sent to this window.
          </template>
          <template v-else>
            No key configured. Add <code>AI_API_KEY</code> to your
            <code>.env</code> file, or enter a key in the Core tab. ZARA runs
            without one — she just can't reach the AI brain.
          </template>
        </p>
      </div>

      <div class="mt-4 flex items-center gap-3">
        <button
          type="button"
          class="btn-test"
          :disabled="testing"
          @click="runTest"
        >
          {{ testing ? 'Testing…' : 'Test Connection' }}
        </button>
        <span
          v-if="testMessage"
          class="test-message"
          :class="testOk ? 'ok' : 'bad'"
        >
          {{ testMessage }}
        </span>
      </div>
    </section>

    <!-- Permissions --------------------------------------------------->
    <section class="panel">
      <div class="flex items-center justify-between mb-3">
        <h3 class="panel-title mb-0">Permissions</h3>
        <button type="button" class="btn-ghost" @click="refresh">
          Refresh
        </button>
      </div>
      <ul class="permission-list">
        <li v-for="name in permissionNames" :key="name" class="permission-row">
          <span>{{ permissionLabel(name) }}</span>
          <span class="perm-pill" :class="permClass(permissions[name])">
            {{ permText(permissions[name]) }}
          </span>
        </li>
      </ul>
      <p class="field-hint">
        ZARA never accesses these without permission. Microphone and camera are
        requested the first time you use them.
      </p>
    </section>

    <!-- Wake word ------------------------------------------------------>
    <section class="panel">
      <h3 class="panel-title">Wake Word</h3>
      <div>
        <label class="field-label">Phrase</label>
        <input class="field-input" value="Zara" readonly />
        <p class="field-hint">
          Say “Zara”, “Hey Zara”, or “Zara, open Google”. Wake-word detection
          runs while the microphone is on — press the mic button to start a
          session, then ZARA keeps listening between turns.
        </p>
      </div>
    </section>

    <!-- Activity ------------------------------------------------------->
    <section class="panel p-0 overflow-hidden">
      <ZaraActivityLog />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ZaraActivityLog from '../ZaraActivityLog.vue'
import {
  ASSISTANT_NAME,
  OWNER_NAME,
  OWNER_NAME_DISPLAY,
} from '../../zara/identity'
import {
  permissions,
  permissionLabel,
  refreshAllPermissions,
} from '../../zara/permissions'
import type { PermissionState, ZaraPermission } from '../../zara/types'
import { testConnection } from '../../zara/aiStatus'

const permissionNames: ZaraPermission[] = [
  'microphone',
  'camera',
  'screen',
  'browser',
  'computer',
  'files',
  'notifications',
]

const config = ref<{
  provider: string
  model: string
  maskedKey: string
  hasApiKey: boolean
  source: string
}>({ provider: '', model: '', maskedKey: '', hasApiKey: false, source: 'none' })

const testing = ref(false)
const testMessage = ref('')
const testOk = ref(false)

const statusText = ref('CHECKING')
const statusPillClass = ref('is-checking')

const loadConfig = async () => {
  try {
    const result = await window.aliceIPC?.invoke('zara:ai-config')
    if (result) config.value = result
  } catch {
    /* desktop-only */
  }
  if (config.value.hasApiKey) {
    statusText.value = 'CONFIGURED'
    statusPillClass.value = 'is-ok'
  } else {
    statusText.value = 'NOT CONFIGURED'
    statusPillClass.value = 'is-warn'
  }
}

const refresh = async () => {
  await refreshAllPermissions()
  await loadConfig()
}

const runTest = async () => {
  testing.value = true
  testMessage.value = ''
  const result = await testConnection()
  testOk.value = result.ok
  testMessage.value = result.message
  testing.value = false
  await loadConfig()
}

const permText = (state: PermissionState) =>
  ({
    granted: 'Granted',
    denied: 'Denied',
    prompt: 'Not requested',
    unavailable: 'Unavailable',
  })[state]

const permClass = (state: PermissionState) => ({
  'is-ok': state === 'granted',
  'is-warn': state === 'prompt',
  'is-bad': state === 'denied',
  'is-off': state === 'unavailable',
})

onMounted(refresh)
</script>

<style scoped>
.panel {
  background: rgba(148, 163, 184, 0.05);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
  padding: 16px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #22d3ee;
  margin: 0 0 12px;
  text-transform: uppercase;
}

.field-label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-size: 13px;
}

.field-input[readonly] {
  color: #cbd5e1;
}

.field-hint {
  font-size: 11px;
  color: #64748b;
  margin-top: 8px;
  line-height: 1.5;
}

.field-hint code {
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-pill,
.perm-pill {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.is-ok {
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.4);
  background: rgba(52, 211, 153, 0.1);
}

.is-warn {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.4);
  background: rgba(251, 191, 36, 0.1);
}

.is-bad {
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
}

.is-off,
.is-checking {
  color: #64748b;
  border-color: rgba(100, 116, 139, 0.4);
  background: rgba(100, 116, 139, 0.1);
}

.permission-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.permission-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #cbd5e1;
  padding: 6px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}

.permission-row:last-child {
  border-bottom: none;
}

.btn-test {
  background: rgba(34, 211, 238, 0.15);
  border: 1px solid rgba(34, 211, 238, 0.5);
  color: #67e8f9;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 12px;
  cursor: pointer;
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
}

.test-message {
  font-size: 12px;
}

.test-message.ok {
  color: #34d399;
}

.test-message.bad {
  color: #fca5a5;
}
</style>
