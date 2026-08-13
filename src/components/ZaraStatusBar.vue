<template>
  <div
    v-if="showBanner"
    class="zara-status-banner"
    :class="bannerClass"
    role="status"
  >
    <span class="status-dot"></span>
    <span class="status-text">{{ bannerText }}</span>
    <button
      v-if="aiStatusValue === 'NOT_CONFIGURED'"
      class="status-action"
      @click="openSettings"
    >
      Open Settings
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { aiStatus, AI_NOT_CONFIGURED_SHORT } from '../zara/aiStatus'
import { permissions } from '../zara/permissions'

const aiStatusValue = computed(() => aiStatus.value)

/**
 * A single honest line about what is currently blocking ZARA. Only the most
 * important issue is shown so the avatar is never buried in warnings.
 */
const bannerText = computed(() => {
  if (aiStatusValue.value === 'NOT_CONFIGURED') return AI_NOT_CONFIGURED_SHORT
  if (permissions.microphone === 'denied')
    return 'MICROPHONE PERMISSION REQUIRED'
  if (permissions.microphone === 'unavailable') return 'NO MICROPHONE DETECTED'
  return ''
})

const showBanner = computed(() => bannerText.value !== '')

const bannerClass = computed(() =>
  aiStatusValue.value === 'NOT_CONFIGURED' ? 'is-warning' : 'is-alert'
)

const openSettings = async () => {
  try {
    await window.aliceIPC?.invoke('settings-window:open')
  } catch {
    /* settings window unavailable in web mode */
  }
}
</script>

<style scoped>
.zara-status-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  backdrop-filter: blur(8px);
  white-space: nowrap;
  pointer-events: auto;
}

.is-warning {
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.45);
  color: #fcd34d;
}

.is-alert {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.45);
  color: #fca5a5;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

.status-action {
  background: transparent;
  border: none;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font-size: 10px;
  letter-spacing: 0.1em;
  padding: 0;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
