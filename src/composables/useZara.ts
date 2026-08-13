/**
 * ZARA — runtime orchestrator.
 *
 * The single entry point both voice and text go through:
 *
 *   LISTENING → UNDERSTANDING → THINKING → ACTION → RESPONSE → SPEAKING → LISTENING
 *
 * Owns the command router, conversation context, activity logging, the
 * presentation state and the continuous-conversation loop (ZARA returns to
 * LISTENING after every turn instead of stopping after one answer).
 */

import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGeneralStore } from '../stores/generalStore'
import { useConversationStore } from '../stores/conversationStore'
import { useActivityStore } from '../stores/activityStore'
import { CommandRouter } from '../zara/commandRouter'
import type { ConversationContext } from '../zara/commandRouter'
import type {
  ActionResult,
  RequestSource,
  ZaraPresentationState,
} from '../zara/types'
import { ok, fail } from '../zara/types'
import {
  fromActionStatus,
  fromAudioState,
  styleFor,
} from '../zara/presentation'
import { isAIConfigured, AI_NOT_CONFIGURED_MESSAGE } from '../zara/aiStatus'
import eventBus from '../utils/eventBus'

/** Module-level so voice and text share one router and one context. */
const context = ref<ConversationContext>({})
const expression = ref<ZaraPresentationState | null>(null)
const pendingConfirmation = ref<{
  question: string
  resolve: (value: boolean) => void
} | null>(null)

let expressionTimer: ReturnType<typeof setTimeout> | null = null

export function useZara() {
  const generalStore = useGeneralStore()
  const conversationStore = useConversationStore()
  const activityStore = useActivityStore()

  const { audioState, isRecordingRequested, isTTSEnabled } =
    storeToRefs(generalStore)

  /**
   * Presentation state: a transient expression (set after an action) wins for
   * a moment, then we fall back to the pipeline-derived state.
   */
  const presentationState = computed<ZaraPresentationState>(
    () => expression.value ?? fromAudioState(audioState.value)
  )

  const presentationStyle = computed(() => styleFor(presentationState.value))

  /** Briefly show an expression, then let it decay back to the base state. */
  const setExpression = (state: ZaraPresentationState, holdMs = 2200) => {
    expression.value = state
    if (expressionTimer) clearTimeout(expressionTimer)
    expressionTimer = setTimeout(() => {
      expression.value = null
      expressionTimer = null
    }, holdMs)
  }

  /** Immediately stops speech so Aitzaz is never forced to wait. */
  const stopSpeaking = () => {
    eventBus.emit('cancel-tts')
    eventBus.emit('cancel-llm-stream')
    generalStore.stopPlaybackAndClearQueue()
    if (audioState.value === 'SPEAKING') {
      generalStore.setAudioState(
        isRecordingRequested.value ? 'LISTENING' : 'IDLE'
      )
    }
  }

  /** Presents a confirmation prompt and waits for the answer. */
  const confirm = (question: string): Promise<boolean> =>
    new Promise(resolve => {
      pendingConfirmation.value = { question, resolve }
    })

  const resolveConfirmation = (accepted: boolean) => {
    pendingConfirmation.value?.resolve(accepted)
    pendingConfirmation.value = null
  }

  const saveMemory = async (content: string): Promise<boolean> => {
    if (!window.aliceIPC) return false
    try {
      const result = await window.aliceIPC.invoke('memory:save', {
        content,
        memoryType: 'user_fact',
      })
      return Boolean(result?.success ?? result)
    } catch {
      return false
    }
  }

  const recallMemories = async (): Promise<string[]> => {
    if (!window.aliceIPC) return []
    try {
      const result = await window.aliceIPC.invoke('memory:get', {})
      const rows = Array.isArray(result) ? result : result?.data || []
      return rows
        .map((row: any) => row?.content)
        .filter((value: unknown): value is string => typeof value === 'string')
        .slice(0, 10)
    } catch {
      return []
    }
  }

  const analyseScreen = async (): Promise<ActionResult> => {
    if (!window.aliceIPC) {
      return fail('Screen reading needs the desktop app.', 'UNSUPPORTED')
    }
    if (!isAIConfigured.value) {
      return fail(AI_NOT_CONFIGURED_MESSAGE, 'PERMISSION_REQUIRED')
    }
    try {
      // Capture, then hand the frame to the vision-capable chat turn.
      eventBus.emit('take-screenshot')
      return ok('Looking at your screen now.')
    } catch (error: any) {
      return fail('I could not capture your screen.', 'FAILED', error?.message)
    }
  }

  const analyseCamera = async (): Promise<ActionResult> => {
    if (!isAIConfigured.value) {
      return fail(AI_NOT_CONFIGURED_MESSAGE, 'PERMISSION_REQUIRED')
    }
    eventBus.emit('zara-open-camera')
    return ok('Opening the camera.')
  }

  const router = new CommandRouter({
    getContext: () => context.value,
    setContext: patch => {
      context.value = { ...context.value, ...patch }
    },
    onIntent: command => {
      activityStore.logOwner(command.utterance)
      activityStore.logIntent(command.intent)
    },
    onResult: (intent, result) => {
      const actor =
        intent.startsWith('BROWSER') ||
        intent.startsWith('OPEN_WEB') ||
        intent.startsWith('SEARCH') ||
        intent.endsWith('TAB') ||
        intent === 'REFRESH_PAGE'
          ? 'BROWSER'
          : intent.endsWith('APPLICATION') || intent === 'SYSTEM_ACTION'
            ? 'COMPUTER'
            : 'SYSTEM'
      activityStore.logResult(actor, result.status, result.message)
      setExpression(fromActionStatus(result.status))
    },
    confirm,
    stopSpeaking,
    saveMemory,
    recallMemories,
    analyseScreen,
    analyseCamera,
  })

  /**
   * Handles one turn end to end. Returns true when the router fully handled it
   * (so the caller should NOT also send the text to the AI brain).
   */
  const handleUtterance = async (
    utterance: string,
    source: RequestSource
  ): Promise<{ handled: boolean; reply?: string }> => {
    const text = (utterance || '').trim()
    if (!text) return { handled: true }

    // "Stop" must cut through even mid-sentence, before anything else.
    if (/^(stop|stop it|be quiet|quiet|shut up|ruko|chup)\b/i.test(text)) {
      stopSpeaking()
      activityStore.log({ actor: 'OWNER', label: text })
      activityStore.logResult('SYSTEM', 'SUCCESS', 'Stopped speaking.')
      return { handled: true }
    }

    const outcome = await router.route(text, source)

    if (outcome.delegateToAI) {
      // Falls through to the AI brain — but only if it is actually configured.
      if (!isAIConfigured.value) {
        activityStore.logResult(
          'SYSTEM',
          'PERMISSION_REQUIRED',
          'AI API NOT CONFIGURED'
        )
        setExpression('CONCERNED')
        return { handled: true, reply: AI_NOT_CONFIGURED_MESSAGE }
      }
      return { handled: false }
    }

    return { handled: true, reply: outcome.reply }
  }

  /**
   * Continuous conversation: after speaking, return to LISTENING so Aitzaz can
   * follow up without touching the mic again.
   */
  const resumeListening = () => {
    if (!isRecordingRequested.value) return
    if (
      audioState.value === 'SPEAKING' ||
      audioState.value === 'WAITING_FOR_RESPONSE'
    ) {
      return
    }
    generalStore.setAudioState('LISTENING')
  }

  return {
    router,
    context,
    presentationState,
    presentationStyle,
    setExpression,
    stopSpeaking,
    handleUtterance,
    resumeListening,
    pendingConfirmation,
    resolveConfirmation,
    isTTSEnabled,
  }
}
