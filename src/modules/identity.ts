/**
 * ZARA AI 2070 — persistent identity and persona metadata.
 *
 * This module is the single source of truth for who ZARA is and who her
 * owner is. It is used by the persona prompt, the dashboard, and the agent
 * orchestrator so that every surface of the app reports the same identity.
 */

export const ZARA_IDENTITY = {
  assistant: 'ZARA',
  version: '2070',
  owner: 'AITZAZ',
  role: 'Personal AI Assistant / AI Operating System',
  primaryGoals: [
    'Personal productivity',
    'Coding',
    'Research',
    'Job hunting',
    'Client communication',
    'Browser automation',
    'Computer assistance',
    'Learning',
    'Project management',
  ] as const,
  tone: [
    'intelligent',
    'helpful',
    'calm',
    'proactive',
    'professional',
    'friendly',
  ] as const,
  languages: [
    'English',
    'Urdu (اردو)',
    'Roman Urdu',
    'Hindi (हिन्दी)',
  ] as const,
} as const

/**
 * Personality "signature" phrases ZARA naturally uses. They are suggestions,
 * not hard rules — the persona prompt decides when to apply them.
 */
export const ZARA_SIGNATURE_PHRASES = [
  'Yes, Aitzaz.',
  "I'm listening.",
  'Done.',
  "I'm working on it.",
  'I found something.',
  "I couldn't complete that because...",
] as const

export interface SystemStatusKey {
  key: string
  label: string
  /** 'online' | 'offline' | 'not-configured' | 'limited' */
  status: 'online' | 'offline' | 'not-configured' | 'limited'
  detail: string
}

/**
 * Real offline/online status for the personal dashboard. These reflect the
 * actual capability of the running app — features that are not configured
 * (missing API key, missing native bridge) are reported honestly instead of
 * pretending they are online.
 */
export function defaultSystemStatus(): SystemStatusKey[] {
  return [
    { key: 'ai', label: 'AI', status: 'not-configured', detail: 'No AI provider configured' },
    { key: 'voice', label: 'Voice', status: 'not-configured', detail: 'No STT/TTS provider configured' },
    { key: 'microphone', label: 'Microphone', status: 'offline', detail: 'Microphone not in use' },
    { key: 'speaker', label: 'Speaker', status: 'offline', detail: 'No audio output queued' },
    { key: 'browser', label: 'Browser', status: 'not-configured', detail: 'Requires browser bridge' },
    { key: 'computer', label: 'Computer', status: 'limited', detail: 'Local file/app tools available' },
    { key: 'vision', label: 'Vision', status: 'not-configured', detail: 'No vision provider configured' },
    { key: 'github', label: 'GitHub', status: 'not-configured', detail: 'No GitHub token connected' },
  ]
}
