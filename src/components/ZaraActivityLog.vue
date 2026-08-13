<template>
  <div class="activity-panel">
    <div class="activity-header">
      <div>
        <h3 class="activity-title">Activity</h3>
        <p class="activity-sub">
          {{ entries.length }} events · {{ successCount }} succeeded ·
          {{ failureCount }} failed
        </p>
      </div>
      <button
        class="activity-clear"
        :disabled="!entries.length"
        @click="activityStore.clear()"
      >
        Clear
      </button>
    </div>

    <div v-if="!entries.length" class="activity-empty">
      Nothing yet. Ask ZARA to do something and it will show up here.
    </div>

    <ul v-else class="activity-list">
      <li v-for="entry in entries" :key="entry.id" class="activity-row">
        <span class="activity-time">{{ formatTime(entry.timestamp) }}</span>
        <span class="activity-actor" :class="actorClass(entry.actor)">
          {{ actorLabel(entry.actor) }}
        </span>
        <span class="activity-label" :class="statusClass(entry.status)">
          {{ entry.label }}
        </span>
        <span v-if="entry.detail" class="activity-detail">{{
          entry.detail
        }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useActivityStore } from '../stores/activityStore'
import type { ActivityActor } from '../stores/activityStore'
import type { ActionStatus } from '../zara/types'
import { OWNER_NAME_DISPLAY, ASSISTANT_NAME } from '../zara/identity'

const activityStore = useActivityStore()
const { entries, successCount, failureCount } = storeToRefs(activityStore)

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

const actorLabel = (actor: ActivityActor) => {
  switch (actor) {
    case 'OWNER':
      return OWNER_NAME_DISPLAY
    case 'ZARA':
      return ASSISTANT_NAME
    case 'BROWSER':
      return 'Browser'
    case 'COMPUTER':
      return 'Computer'
    default:
      return 'System'
  }
}

const actorClass = (actor: ActivityActor) => ({
  'is-owner': actor === 'OWNER',
  'is-zara': actor === 'ZARA',
  'is-system': actor !== 'OWNER' && actor !== 'ZARA',
})

const statusClass = (status?: ActionStatus) => {
  if (!status) return ''
  if (status === 'SUCCESS') return 'is-success'
  if (status === 'CONFIRMATION_REQUIRED') return 'is-pending'
  return 'is-failure'
}
</script>

<style scoped>
.activity-panel {
  padding: 16px;
  color: #e2e8f0;
}

.activity-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.activity-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.activity-sub {
  margin: 4px 0 0;
  font-size: 11px;
  color: #64748b;
}

.activity-clear {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.activity-clear:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.activity-clear:not(:disabled):hover {
  border-color: rgba(239, 68, 68, 0.6);
  color: #fca5a5;
}

.activity-empty {
  font-size: 12px;
  color: #64748b;
  padding: 24px 4px;
  text-align: center;
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.activity-row {
  display: grid;
  grid-template-columns: 52px 68px 1fr;
  gap: 8px;
  align-items: baseline;
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.05);
}

.activity-time {
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.activity-actor {
  font-weight: 600;
  letter-spacing: 0.04em;
}

.activity-actor.is-owner {
  color: #7dd3fc;
}

.activity-actor.is-zara {
  color: #22d3ee;
}

.activity-actor.is-system {
  color: #a78bfa;
}

.activity-label {
  color: #cbd5e1;
  word-break: break-word;
}

.activity-label.is-success {
  color: #34d399;
}

.activity-label.is-failure {
  color: #fca5a5;
}

.activity-label.is-pending {
  color: #fbbf24;
}

.activity-detail {
  grid-column: 3;
  color: #64748b;
  font-size: 10px;
}
</style>
