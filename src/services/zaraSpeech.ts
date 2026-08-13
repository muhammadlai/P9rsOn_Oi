/**
 * ZARA — speech output.
 *
 * Used for replies the command router produces itself (action confirmations,
 * failures, wake-word acknowledgements) — i.e. speech that does NOT come from
 * the LLM stream.
 *
 * Fallback chain, so ZARA can always talk:
 *   1. The app's TTS pipeline (local Piper, or the cloud voice when configured)
 *   2. The browser's built-in SpeechSynthesis — works with no API key at all
 */

import { useGeneralStore } from '../stores/generalStore'
import { ttsStream } from './apiService'
import { isExpectedAbortError } from '../utils/isAbortError'

let activeController: AbortController | null = null

/** Cancels any speech currently in flight. */
export function cancelSpeech(): void {
  activeController?.abort()
  activeController = null
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel()
  }
}

/** Browser-native speech — the always-available fallback. */
function speakWithBrowser(text: string, volume: number, rate: number): boolean {
  if (
    typeof speechSynthesis === 'undefined' ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false
  }
  try {
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.volume = volume
    utterance.rate = rate

    // Prefer a female English voice to match ZARA's presentation.
    const voices = speechSynthesis.getVoices()
    const preferred =
      voices.find(
        v =>
          /female|zira|samantha|aria|jenny/i.test(v.name) && /^en/i.test(v.lang)
      ) || voices.find(v => /^en/i.test(v.lang))
    if (preferred) utterance.voice = preferred

    speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}

export interface SpeakOptions {
  /** 0..1 */
  volume?: number
  /** 0.5..2 */
  rate?: number
}

/**
 * Speaks a short line in ZARA's voice. Honours the speaker toggle and never
 * throws — speech failure must not break the conversation loop.
 */
export async function speakText(
  text: string,
  options: SpeakOptions = {}
): Promise<void> {
  const trimmed = (text || '').trim()
  if (!trimmed) return

  const generalStore = useGeneralStore()
  if (!generalStore.isTTSEnabled) return

  const volume = options.volume ?? 1
  const rate = options.rate ?? 1

  cancelSpeech()
  activeController = new AbortController()

  try {
    const response = await ttsStream(trimmed, activeController.signal)

    if (response && response.status !== 204) {
      const queued = generalStore.queueAudioForPlayback(response)
      if (queued) {
        if (generalStore.audioState !== 'SPEAKING') {
          generalStore.setAudioState('SPEAKING')
        }
        return
      }
    }
    // 204 / not queued — fall through to the browser voice.
    speakWithBrowser(trimmed, volume, rate)
  } catch (error) {
    if (isExpectedAbortError(error)) return
    // The cloud/local TTS is unavailable (commonly: no API key configured).
    // Browser speech keeps ZARA audible instead of silently failing.
    speakWithBrowser(trimmed, volume, rate)
  } finally {
    activeController = null
  }
}
