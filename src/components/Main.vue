<template>
  <div class="h-screen flex w-full items-center justify-start relative">
    <div
      class="avatar-wrapper flex container h-full items-center justify-center relative z-2"
      :class="{ mini: isMinimized }"
    >
      <div class="avatar" :class="{ open: openSidebar }">
        <div
          class="avatar-ring"
          :style="avatarRingStyle"
          :class="{
            'ring-green-500!': audioState === 'SPEAKING',
            'ring-cyan-500!':
              audioState === 'PROCESSING_AUDIO' ||
              audioState === 'WAITING_FOR_RESPONSE',
            'ring-blue-500!': audioState === 'LISTENING',
            'w-[200px] h-[200px]': isMinimized,
            'w-[480px] h-[480px]': !isMinimized && isElectron,
            'w-[430px] h-[430px]': !isElectron,
          }"
        >
          <audio ref="audioPlayerElement" class="hidden"></audio>
          <video
            class="max-w-screen-md rounded-full"
            :class="{
              'h-[200px]': isMinimized,
              'h-[480px]': !isMinimized && isElectron,
              'h-[430px]': !isElectron,
            }"
            ref="aiVideoElement"
            :src="videoSource"
            loop
            muted
            autoplay
            playsinline
          ></video>
          <Actions
            @takeScreenShot="handleTakeScreenshot"
            @togglePlaying="handleToggleTTS"
            @toggleRecording="handleToggleRecording"
            @openCamera="handleOpenCamera"
            :isElectron="isElectron"
            :isTTSEnabled="isTTSEnabled"
            :audioState="audioState"
          />
        </div>
      </div>
      <Sidebar @processRequest="processRequestFromSidebar" />
    </div>

    <ZaraStatusBar />
    <ZaraConfirmDialog />
    <ZaraCamera @analyse="handleCameraFrame" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref as vueRef } from 'vue'
import type { CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import Actions from './Actions.vue'
import Sidebar from './Sidebar.vue'
import ZaraStatusBar from './ZaraStatusBar.vue'
import ZaraConfirmDialog from './ZaraConfirmDialog.vue'
import ZaraCamera from './ZaraCamera.vue'

import { useGeneralStore } from '../stores/generalStore'
import { useConversationStore } from '../stores/conversationStore'
import {
  indexMessageForThoughts,
  uploadFileToOpenAI,
} from '../services/apiService'
import type { ChatMessage, AppChatMessageContentPart } from '../types/chat'
import { useAudioProcessing } from '../composables/useAudioProcessing'
import { useAudioPlayback } from '../composables/useAudioPlayback'
import { useScreenshot } from '../composables/useScreenshot'
import eventBus from '../utils/eventBus'
import { useZara } from '../composables/useZara'
import { refreshAllPermissions } from '../zara/permissions'
import { evaluateAIStatus, isAIConfigured } from '../zara/aiStatus'
import { readyGreeting, notConfiguredGreeting } from '../zara/identity'
import { speakText } from '../services/zaraSpeech'

const audioProcessing = useAudioProcessing()
const { toggleRecordingRequest } = audioProcessing
const { toggleTTSPreference } = useAudioPlayback()
const {
  screenShot,
  screenshotReady,
  takeScreenShot,
  setupScreenshotListeners,
  cleanupScreenshotListeners,
} = useScreenshot()

const generalStore = useGeneralStore()
const conversationStore = useConversationStore()
const zara = useZara()
const { handleUtterance, resumeListening, stopSpeaking } = zara

const {
  audioState,
  aiVideo,
  videoSource,
  audioPlayer,
  chatInput,
  openSidebar,
  isMinimized,
  isTTSEnabled,
  isRecordingRequested,
  takingScreenShot,
  avatarFallbackImage,
} = storeToRefs(generalStore)
const { setAudioState } = generalStore

const isElectron =
  typeof window !== 'undefined' && Boolean((window as any).electron)
const audioPlayerElement = vueRef<HTMLAudioElement | null>(null)
const aiVideoElement = vueRef<HTMLVideoElement | null>(null)

let isProcessingRequest = false

const avatarRingStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {
    backgroundColor: '#050505',
    // Glow reflects ZARA's current presentation state.
    boxShadow: `0 0 60px ${zara.presentationStyle.value.glow}`,
    transition: 'box-shadow 0.4s ease-in-out',
  }
  if (avatarFallbackImage.value) {
    style.backgroundImage = `url(${avatarFallbackImage.value})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
    style.backgroundRepeat = 'no-repeat'
  }
  return style
})

onMounted(async () => {
  audioPlayer.value = audioPlayerElement.value
  aiVideo.value = aiVideoElement.value

  if (aiVideo.value) {
    aiVideo.value
      .play()
      .catch(e => console.warn('Initial video play failed:', e))
  }

  if (isElectron) {
    setupScreenshotListeners()
  }

  eventBus.on('processing-complete', handleProcessingComplete)
  eventBus.on('mute-playback-toggle', handleToggleTTS)
  eventBus.on('take-screenshot', handleTakeScreenshot)

  await runStartupSequence()
})

/**
 * ZARA startup:
 *   LOAD CONFIG → CHECK PERMISSIONS → CHECK AI SERVICE → READY
 * Every check is non-fatal: a missing key or denied mic degrades a feature,
 * it never prevents the app from launching.
 */
const runStartupSequence = async () => {
  try {
    await refreshAllPermissions()
  } catch (error) {
    console.warn('[Zara Startup] Permission check failed:', error)
  }

  let aiConfig: any = null
  try {
    aiConfig = await window.aliceIPC?.invoke('zara:ai-config')
  } catch (error) {
    console.warn('[Zara Startup] Could not read AI config:', error)
  }

  evaluateAIStatus({
    aiProvider: aiConfig?.provider,
    assistantModel: aiConfig?.model,
    hasApiKey: Boolean(aiConfig?.hasApiKey),
    baseUrl: aiConfig?.baseUrl,
  })

  if (isAIConfigured.value) {
    generalStore.statusMessage = 'Zara ready'
    await speakText(readyGreeting())
  } else {
    generalStore.statusMessage = 'AI API not configured'
    await speakText(notConfiguredGreeting())
  }
}

/** Camera frame captured — send it to the vision-capable AI turn. */
const handleCameraFrame = async (payload: {
  image: string
  question: string
}) => {
  if (!isAIConfigured.value) {
    generalStore.statusMessage = 'AI API not configured'
    await speakText(
      'I can see the camera, but my AI service is not configured yet.'
    )
    return
  }

  generalStore.addMessageToHistory({
    role: 'user',
    content: [
      { type: 'app_text', text: payload.question },
      { type: 'app_image_uri', uri: payload.image },
    ],
  })

  setAudioState('WAITING_FOR_RESPONSE')
  try {
    await conversationStore.chat()
  } catch (error) {
    console.error('[Zara Vision] Camera analysis failed:', error)
    generalStore.statusMessage = 'Error: Vision analysis failed'
    setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
  }
}

onUnmounted(() => {
  if (isElectron) {
    cleanupScreenshotListeners()
  }
  aiVideo.value = null
  eventBus.off('processing-complete', handleProcessingComplete)
  eventBus.off('mute-playback-toggle', handleToggleTTS)
  eventBus.off('take-screenshot', handleTakeScreenshot)
})

const handleTakeScreenshot = () => {
  if (isElectron && !takingScreenShot.value) {
    takeScreenShot()
  }
}

const handleToggleTTS = () => {
  toggleTTSPreference()
}

const handleToggleRecording = () => {
  // Activating the mic also interrupts any speech in progress, so Aitzaz
  // never has to wait for ZARA to finish before speaking.
  if (generalStore.audioState === 'SPEAKING') {
    stopSpeaking()
  }
  toggleRecordingRequest()
}

const handleOpenCamera = () => {
  eventBus.emit('zara-open-camera')
}

const handleProcessingComplete = (transcription: string) => {
  const meaningfulTranscription =
    transcription && transcription.trim().length > 1

  if (isProcessingRequest) {
    return
  }

  if (
    meaningfulTranscription &&
    (audioState.value === 'PROCESSING_AUDIO' ||
      audioState.value === 'LISTENING')
  ) {
    generalStore.recognizedText = transcription
    processRequest(transcription, 'VOICE')
  } else {
    if (
      audioState.value !== 'SPEAKING' &&
      audioState.value !== 'WAITING_FOR_RESPONSE'
    ) {
      setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
    }
  }
}

const processRequestFromSidebar = (text: string) => {
  if (isProcessingRequest) {
    generalStore.statusMessage = 'Processing previous request...'
    setTimeout(() => {
      generalStore.setAudioState(audioState.value)
    }, 2000)
    return
  }
  if (text.trim() || generalStore.attachedFile) {
    if (
      audioState.value === 'IDLE' ||
      audioState.value === 'LISTENING' ||
      audioState.value === 'WAITING_FOR_RESPONSE' ||
      audioState.value === 'SPEAKING'
    ) {
      generalStore.recognizedText = ''
      processRequest(text, 'SIDEBAR_TEXT')
    } else {
      generalStore.statusMessage = 'Busy, please wait...'

      setTimeout(() => {
        if (generalStore.statusMessage === 'Busy, please wait...')
          generalStore.setAudioState(audioState.value)
      }, 2000)
    }
  }
}

const processRequest = async (
  text: string,
  source: 'VOICE' | 'SIDEBAR_TEXT'
) => {
  if (isProcessingRequest) {
    return
  }
  isProcessingRequest = true

  setAudioState('WAITING_FOR_RESPONSE')

  // ---------------------------------------------------------------------
  // ZARA command router runs FIRST for both voice and text. Deterministic
  // commands (open site, search, tab control, app launch, time, memory) are
  // executed here so they work instantly and even with no API key. Anything
  // it does not own is delegated to the AI brain below.
  // ---------------------------------------------------------------------
  if (text && !generalStore.attachedFile && !screenshotReady.value) {
    try {
      const routed = await handleUtterance(
        text,
        source === 'VOICE' ? 'VOICE' : 'TEXT'
      )

      if (routed.handled) {
        // Show the exchange in the chat panel so voice and text stay in sync.
        generalStore.addMessageToHistory({
          role: 'user',
          content: [{ type: 'app_text', text }],
        })
        if (routed.reply) {
          generalStore.addMessageToHistory({
            role: 'assistant',
            content: [{ type: 'app_text', text: routed.reply }],
          })
          await speakText(routed.reply)
        }

        isProcessingRequest = false
        // Continuous conversation: hand the turn straight back to the mic.
        if (generalStore.audioState !== 'SPEAKING') {
          setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
        }
        eventBus.emit('zara-turn-complete')
        return
      }
    } catch (routerError) {
      console.error('[Zara Router] Routing failed:', routerError)
      // Fall through to the AI brain rather than dropping the request.
    }
  }

  const appContentParts: AppChatMessageContentPart[] = []

  const fileToProcess = generalStore.attachedFile
  if (fileToProcess) {
    generalStore.statusMessage = `Uploading ${fileToProcess.name}...`
    try {
      const uploadedFileId = await uploadFileToOpenAI(fileToProcess)
      if (uploadedFileId) {
        appContentParts.push({
          type: 'app_file',
          fileId: uploadedFileId,
          fileName: fileToProcess.name,
        })
      } else {
        generalStore.statusMessage = 'Error: PDF file upload failed.'
        isProcessingRequest = false
        setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
        generalStore.attachedFile = null
        return
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      generalStore.statusMessage = 'Error: PDF file upload failed.'
      isProcessingRequest = false
      setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
      generalStore.attachedFile = null
      return
    }
    generalStore.attachedFile = null
  }

  if (text) {
    appContentParts.push({ type: 'app_text', text: text })
  }

  if (screenshotReady.value && screenShot.value) {
    appContentParts.push({ type: 'app_image_uri', uri: screenShot.value })
    screenshotReady.value = false
    screenShot.value = ''
  }

  if (appContentParts.length === 0) {
    generalStore.statusMessage = 'Nothing to send.'
    isProcessingRequest = false
    setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
    return
  }

  const userMessage: ChatMessage = {
    role: 'user',
    content: appContentParts,
  }

  try {
    let userTextForIndexing = ''
    if (Array.isArray(userMessage.content)) {
      const textParts = userMessage.content
        .filter(p => p.type === 'app_text' && p.text)
        .map(p => p.text!)
      userTextForIndexing = textParts.join(' ')
    }

    if (userTextForIndexing) {
      const conversationIdForThought =
        conversationStore.currentResponseId || 'default_conversation'
      await indexMessageForThoughts(conversationIdForThought, 'user', {
        content: appContentParts,
      })
    }
  } catch (e) {
    console.error(
      '[Main.vue] Error calling indexMessageForThoughts for user message:',
      e
    )
  }

  generalStore.addMessageToHistory(userMessage)
  try {
    const chatPromise = conversationStore.chat()

    const timeoutPromise = new Promise((_, reject) => {
      let timeoutId: NodeJS.Timeout
      let hasImageGeneration = false

      const startTimeout = () => {
        timeoutId = setTimeout(() => {
          if (generalStore.audioState === 'GENERATING_IMAGE') {
            console.log(
              '[Timeout] Skipping timeout - image generation in progress'
            )
            startTimeout()
            return
          }
          reject(new Error('Chat request timeout after 90 seconds'))
        }, 90000)
      }

      const stateWatcher = () => {
        if (
          generalStore.audioState === 'GENERATING_IMAGE' &&
          !hasImageGeneration
        ) {
          console.log('[Timeout] Image generation started, disabling timeout')
          clearTimeout(timeoutId)
          hasImageGeneration = true
        }
      }

      startTimeout()
      const intervalId = setInterval(stateWatcher, 500)

      chatPromise.finally(() => {
        clearTimeout(timeoutId)
        clearInterval(intervalId)
      })
    })

    await Promise.race([chatPromise, timeoutPromise])
  } catch (e) {
    console.error(
      `[Main.vue processRequest (${source})] Error during conversationStore.chat():`,
      e
    )

    if (
      generalStore.audioState !== 'IDLE' &&
      generalStore.audioState !== 'LISTENING' &&
      generalStore.audioState !== 'GENERATING_IMAGE'
    ) {
      console.log('[Error Recovery] Resetting audio state to prevent UI lock')
      setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
    }
  } finally {
    isProcessingRequest = false

    setTimeout(() => {
      if (
        generalStore.audioState === 'WAITING_FOR_RESPONSE' ||
        generalStore.audioState === 'PROCESSING_AUDIO'
      ) {
        console.log(
          '[Safety Recovery] Detected stuck audio state, resetting to interactive mode'
        )
        setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
      }
    }, 2000)
  }
}
</script>

<style scoped lang="postcss">
.avatar-ring {
  transition: ring-color 0.3s ease-in-out;
}
</style>
