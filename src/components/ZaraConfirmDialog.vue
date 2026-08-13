<template>
  <transition name="fade">
    <div
      v-if="pending"
      class="confirm-overlay"
      role="alertdialog"
      aria-modal="true"
    >
      <div class="confirm-card">
        <div class="confirm-icon">!</div>
        <p class="confirm-question">{{ pending.question }}</p>
        <p class="confirm-hint">
          This action could change or remove something. Confirm to continue.
        </p>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="respond(false)">Cancel</button>
          <button class="btn-confirm" @click="respond(true)">
            Yes, continue
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useZara } from '../composables/useZara'

const { pendingConfirmation, resolveConfirmation } = useZara()

const pending = computed(() => pendingConfirmation.value)

const respond = (accepted: boolean) => resolveConfirmation(accepted)
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
}

.confirm-card {
  width: min(360px, 88vw);
  padding: 24px;
  border-radius: 16px;
  background: #0a0f14;
  border: 1px solid rgba(34, 211, 238, 0.35);
  box-shadow: 0 0 40px rgba(34, 211, 238, 0.18);
  text-align: center;
  color: #e2f7ff;
}

.confirm-icon {
  width: 40px;
  height: 40px;
  margin: 0 auto 14px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.5);
  background: rgba(251, 191, 36, 0.1);
}

.confirm-question {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
}

.confirm-hint {
  font-size: 12px;
  color: #7c93a3;
  margin: 0 0 20px;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.confirm-actions button {
  flex: 1;
  padding: 9px 12px;
  border-radius: 9px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.btn-cancel {
  background: transparent;
  border-color: rgba(148, 163, 184, 0.35);
  color: #94a3b8;
}

.btn-cancel:hover {
  border-color: rgba(148, 163, 184, 0.7);
  color: #cbd5e1;
}

.btn-confirm {
  background: rgba(34, 211, 238, 0.15);
  border-color: rgba(34, 211, 238, 0.6);
  color: #67e8f9;
}

.btn-confirm:hover {
  background: rgba(34, 211, 238, 0.28);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
