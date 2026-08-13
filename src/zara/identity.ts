/**
 * ZARA — identity constants.
 *
 * Single source of truth for the assistant identity and her owner.
 * Everything else (prompts, wake word, greetings, memory seeding) derives
 * from here so the identity can never drift between modules.
 */

export const ASSISTANT_NAME = 'ZARA' as const
export const ASSISTANT_NAME_DISPLAY = 'Zara' as const
export const OWNER_NAME = 'AITZAZ' as const
export const OWNER_NAME_DISPLAY = 'Aitzaz' as const

/** Primary wake word plus the natural variations Aitzaz is likely to say. */
export const WAKE_WORD = 'zara' as const

export const WAKE_WORD_PREFIXES = [
  'hey zara',
  'ok zara',
  'okay zara',
  'hi zara',
  'hello zara',
  'yo zara',
  'zara',
] as const

/**
 * Seed memories written on first run so ZARA knows who she is talking to
 * even before Aitzaz teaches her anything.
 */
export const IDENTITY_SEED_MEMORIES: ReadonlyArray<{
  content: string
  memoryType: string
}> = [
  {
    content: `My owner and primary user is ${OWNER_NAME_DISPLAY}.`,
    memoryType: 'identity',
  },
  {
    content: `I am ${ASSISTANT_NAME_DISPLAY}, ${OWNER_NAME_DISPLAY}'s personal AI assistant.`,
    memoryType: 'identity',
  },
]

/** Spoken on a successful, fully-configured startup. */
export function readyGreeting(): string {
  return `Welcome back, ${OWNER_NAME_DISPLAY}. I'm ready.`
}

/** Spoken on startup when no AI credential has been configured yet. */
export function notConfiguredGreeting(): string {
  return `Your AI service isn't configured yet. Add your API key in Settings when you're ready.`
}
