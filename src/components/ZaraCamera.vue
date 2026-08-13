<template>
  <transition name="fade">
    <div v-if="open" class="camera-overlay" role="dialog" aria-modal="true">
      <div class="camera-card">
        <div class="camera-header">
          <span class="camera-title">ZARA VISION</span>
          <button class="camera-close" @click="close" aria-label="Close camera">
            ✕
          </button>
        </div>

        <div class="camera-stage">
          <video
            v-show="state === 'live'"
            ref="videoEl"
            class="camera-video"
            autoplay
            playsinline
            muted
          ></video>

          <img
            v-if="state === 'captured'"
            :src="capturedImage"
            class="camera-video"
            alt="Captured frame"
          />

          <div v-if="state === 'requesting'" class="camera-message">
            Requesting camera permission…
          </div>

          <div v-if="state === 'denied'" class="camera-message is-error">
            <strong>CAMERA PERMISSION REQUIRED</strong>
            <p>Allow camera access in your system settings, then try again.</p>
          </div>

          <div v-if="state === 'unavailable'" class="camera-message is-error">
            <strong>NO CAMERA DETECTED</strong>
            <p>I couldn't find a camera on this device.</p>
          </div>
        </div>

        <div class="camera-controls">
          <template v-if="state === 'live'">
            <input
              v-model="question"
              class="camera-input"
              placeholder="What do you see?"
              @keyup.enter="capture"
            />
            <button class="camera-btn" @click="capture">
              Capture &amp; Ask
            </button>
          </template>
          <template v-else-if="state === 'captured'">
            <button class="camera-btn ghost" @click="retake">Retake</button>
            <span class="camera-sent">Sent to ZARA</span>
          </template>
          <template v-else-if="state === 'denied' || state === 'unavailable'">
            <button class="camera-btn" @click="start">Try again</button>
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onUnmounted, nextTick } from 'vue'
import { requestCamera } from '../zara/permissions'
import eventBus from '../utils/eventBus'

type CameraState =
  'idle' | 'requesting' | 'live' | 'captured' | 'denied' | 'unavailable'

const emit = defineEmits<{
  (e: 'analyse', payload: { image: string; question: string }): void
}>()

const open = ref(false)
const state = ref<CameraState>('idle')
const question = ref('')
const capturedImage = ref('')
const videoEl = ref<HTMLVideoElement | null>(null)

let stream: MediaStream | null = null

const stopStream = () => {
  stream?.getTracks().forEach(track => track.stop())
  stream = null
}

/** Never opens the camera without an explicit permission grant. */
const start = async () => {
  open.value = true
  state.value = 'requesting'
  capturedImage.value = ''

  const { state: permission, stream: granted } = await requestCamera()

  if (permission !== 'granted' || !granted) {
    state.value = permission === 'unavailable' ? 'unavailable' : 'denied'
    return
  }

  stream = granted
  state.value = 'live'
  await nextTick()
  if (videoEl.value) {
    videoEl.value.srcObject = granted
    try {
      await videoEl.value.play()
    } catch {
      /* autoplay guard — the element is muted so this rarely triggers */
    }
  }
}

const capture = () => {
  const video = videoEl.value
  if (!video || !video.videoWidth) return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) return

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  capturedImage.value = canvas.toDataURL('image/jpeg', 0.88)
  state.value = 'captured'

  emit('analyse', {
    image: capturedImage.value,
    question: question.value.trim() || 'What do you see?',
  })

  stopStream()
  setTimeout(close, 1200)
}

const retake = () => {
  capturedImage.value = ''
  start()
}

const close = () => {
  stopStream()
  open.value = false
  state.value = 'idle'
  question.value = ''
}

const handleOpenRequest = () => {
  void start()
}

eventBus.on('zara-open-camera', handleOpenRequest)

onUnmounted(() => {
  eventBus.off('zara-open-camera', handleOpenRequest)
  stopStream()
})

defineExpose({ start, close })
</script>

<style scoped>
.camera-overlay {
  position: fixed;
  inset: 0;
  z-index: 180;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
}

.camera-card {
  width: min(520px, 92vw);
  border-radius: 16px;
  overflow: hidden;
  background: #05090d;
  border: 1px solid rgba(34, 211, 238, 0.35);
  box-shadow: 0 0 48px rgba(34, 211, 238, 0.2);
}

.camera-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(34, 211, 238, 0.18);
}

.camera-title {
  font-size: 11px;
  letter-spacing: 0.22em;
  color: #22d3ee;
  font-weight: 700;
}

.camera-close {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
}

.camera-close:hover {
  color: #e2e8f0;
}

.camera-stage {
  position: relative;
  aspect-ratio: 4 / 3;
  background: #000;
  display: grid;
  place-items: center;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-message {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  padding: 20px;
}

.camera-message.is-error strong {
  display: block;
  color: #fca5a5;
  letter-spacing: 0.12em;
  font-size: 12px;
  margin-bottom: 8px;
}

.camera-message p {
  margin: 0;
  font-size: 12px;
}

.camera-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.camera-input {
  flex: 1;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
}

.camera-input:focus {
  border-color: rgba(34, 211, 238, 0.6);
}

.camera-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(34, 211, 238, 0.55);
  background: rgba(34, 211, 238, 0.15);
  color: #67e8f9;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.camera-btn:hover {
  background: rgba(34, 211, 238, 0.28);
}

.camera-btn.ghost {
  background: transparent;
  border-color: rgba(148, 163, 184, 0.35);
  color: #94a3b8;
}

.camera-sent {
  font-size: 12px;
  color: #34d399;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
