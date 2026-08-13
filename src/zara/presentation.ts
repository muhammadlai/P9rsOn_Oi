/**
 * ZARA — presentation / expression system.
 *
 * Maps ZARA's current activity to avatar animation, glow colour and UI accents.
 * This is a PRESENTATION layer: it conveys what she is doing, it is not a claim
 * that she experiences emotions.
 */

import type { ActionStatus, ZaraPresentationState } from './types'
import type { AudioState } from '../stores/generalStore'

export interface PresentationStyle {
  /** Tailwind ring colour class applied to the avatar ring. */
  ring: string
  /** CSS glow colour. */
  glow: string
  /** Short label surfaced under the avatar. */
  label: string
  /** Which avatar video variant to prefer. */
  video: 'standby' | 'thinking' | 'speaking'
  /** Whether the waveform visualiser should be active. */
  waveform: boolean
}

export const PRESENTATION_STYLES: Record<
  ZaraPresentationState,
  PresentationStyle
> = {
  IDLE: {
    ring: 'ring-cyan-900/60',
    glow: 'rgba(34, 211, 238, 0.25)',
    label: 'Stand by',
    video: 'standby',
    waveform: false,
  },
  LISTENING: {
    ring: 'ring-blue-500',
    glow: 'rgba(59, 130, 246, 0.75)',
    label: 'Listening',
    video: 'standby',
    waveform: true,
  },
  THINKING: {
    ring: 'ring-cyan-400',
    glow: 'rgba(34, 211, 238, 0.8)',
    label: 'Thinking',
    video: 'thinking',
    waveform: false,
  },
  SPEAKING: {
    ring: 'ring-emerald-400',
    glow: 'rgba(52, 211, 153, 0.8)',
    label: 'Speaking',
    video: 'speaking',
    waveform: true,
  },
  EXECUTING: {
    ring: 'ring-violet-400',
    glow: 'rgba(167, 139, 250, 0.8)',
    label: 'Working',
    video: 'thinking',
    waveform: false,
  },
  HAPPY: {
    ring: 'ring-teal-300',
    glow: 'rgba(94, 234, 212, 0.8)',
    label: 'Happy to help',
    video: 'speaking',
    waveform: true,
  },
  CURIOUS: {
    ring: 'ring-sky-300',
    glow: 'rgba(125, 211, 252, 0.8)',
    label: 'Curious',
    video: 'thinking',
    waveform: false,
  },
  EXCITED: {
    ring: 'ring-fuchsia-400',
    glow: 'rgba(232, 121, 249, 0.85)',
    label: 'Excited',
    video: 'speaking',
    waveform: true,
  },
  CALM: {
    ring: 'ring-indigo-300',
    glow: 'rgba(165, 180, 252, 0.6)',
    label: 'Calm',
    video: 'standby',
    waveform: false,
  },
  CONCERNED: {
    ring: 'ring-amber-400',
    glow: 'rgba(251, 191, 36, 0.8)',
    label: 'Something needs attention',
    video: 'standby',
    waveform: false,
  },
  ERROR: {
    ring: 'ring-red-500',
    glow: 'rgba(239, 68, 68, 0.85)',
    label: 'Error',
    video: 'standby',
    waveform: false,
  },
}

/** Derives the presentation state from the underlying audio pipeline state. */
export function fromAudioState(audio: AudioState): ZaraPresentationState {
  switch (audio) {
    case 'LISTENING':
      return 'LISTENING'
    case 'PROCESSING_AUDIO':
    case 'WAITING_FOR_RESPONSE':
      return 'THINKING'
    case 'GENERATING_IMAGE':
      return 'EXECUTING'
    case 'SPEAKING':
      return 'SPEAKING'
    case 'CONFIG':
      return 'CALM'
    case 'IDLE':
    default:
      return 'IDLE'
  }
}

/** Picks an expression to reflect how an action actually turned out. */
export function fromActionStatus(status: ActionStatus): ZaraPresentationState {
  switch (status) {
    case 'SUCCESS':
      return 'HAPPY'
    case 'CONFIRMATION_REQUIRED':
      return 'CURIOUS'
    case 'PERMISSION_REQUIRED':
    case 'NOT_CONNECTED':
    case 'UNSUPPORTED':
      return 'CONCERNED'
    case 'FAILED':
    default:
      return 'ERROR'
  }
}

export function styleFor(state: ZaraPresentationState): PresentationStyle {
  return PRESENTATION_STYLES[state] ?? PRESENTATION_STYLES.IDLE
}
