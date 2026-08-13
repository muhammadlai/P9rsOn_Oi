/**
 * ZARA — AI service status.
 *
 * The app must launch and stay usable with no API key configured. This module
 * is the single place that answers "can the AI brain actually run right now?"
 * so every other module can degrade gracefully instead of crashing.
 *
 * The renderer never sees the raw key — only whether one is present and a
 * masked preview supplied by the main process.
 */

import { computed, ref } from 'vue'

export type AIStatus = 'READY' | 'NOT_CONFIGURED' | 'CHECKING' | 'ERROR'

export const AI_NOT_CONFIGURED_MESSAGE =
  'AI service is not configured yet. Add your API key in Settings when you are ready.'

export const AI_NOT_CONFIGURED_SHORT = 'AI API NOT CONFIGURED'

const status = ref<AIStatus>('CHECKING')
const detail = ref<string>('')
const maskedKey = ref<string>('')
const providerName = ref<string>('')
const modelName = ref<string>('')

export const aiStatus = computed(() => status.value)
export const aiStatusDetail = computed(() => detail.value)
export const aiMaskedKey = computed(() => maskedKey.value)
export const aiProviderName = computed(() => providerName.value)
export const aiModelName = computed(() => modelName.value)

export const isAIConfigured = computed(() => status.value === 'READY')

/** Masks a credential for display. Never returns more than a hint. */
export function maskKey(key: string | undefined | null): string {
  if (!key) return ''
  return '••••••••••••••••'
}

/**
 * Recomputes AI availability from the current settings snapshot.
 * `settings` is the public settings object — secrets are represented only by
 * presence flags supplied by the main process.
 */
export function evaluateAIStatus(settings: {
  aiProvider?: string
  assistantModel?: string
  hasApiKey?: boolean
  baseUrl?: string
}): AIStatus {
  providerName.value = settings.aiProvider || ''
  modelName.value = settings.assistantModel || ''

  // Local providers need a reachable base URL rather than a key.
  const isLocalProvider =
    settings.aiProvider === 'ollama' || settings.aiProvider === 'lm-studio'

  if (isLocalProvider) {
    if (settings.baseUrl) {
      status.value = 'READY'
      detail.value = `Connected to local ${settings.aiProvider} runtime.`
      maskedKey.value = 'not required'
      return status.value
    }
    status.value = 'NOT_CONFIGURED'
    detail.value = `Set the ${settings.aiProvider} base URL in Settings.`
    maskedKey.value = ''
    return status.value
  }

  if (settings.hasApiKey) {
    status.value = 'READY'
    detail.value = 'AI service configured.'
    maskedKey.value = maskKey('present')
    return status.value
  }

  status.value = 'NOT_CONFIGURED'
  detail.value = AI_NOT_CONFIGURED_MESSAGE
  maskedKey.value = ''
  return status.value
}

export function setAIStatus(next: AIStatus, message = '') {
  status.value = next
  detail.value = message
}

/**
 * Asks the main process to verify the stored credential against the provider.
 * Returns a plain result — the key itself never crosses the bridge.
 */
export async function testConnection(): Promise<{
  ok: boolean
  message: string
}> {
  if (typeof window === 'undefined' || !window.aliceIPC) {
    return { ok: false, message: 'Connection testing needs the desktop app.' }
  }
  status.value = 'CHECKING'
  try {
    const result = await window.aliceIPC.invoke('zara:ai-test-connection')
    if (result?.success) {
      status.value = 'READY'
      detail.value = result.message || 'Connection successful.'
      return { ok: true, message: detail.value }
    }
    status.value =
      result?.reason === 'not-configured' ? 'NOT_CONFIGURED' : 'ERROR'
    detail.value = result?.message || 'Connection failed.'
    return { ok: false, message: detail.value }
  } catch (error: any) {
    status.value = 'ERROR'
    detail.value = error?.message || 'Connection test failed.'
    return { ok: false, message: detail.value }
  }
}
