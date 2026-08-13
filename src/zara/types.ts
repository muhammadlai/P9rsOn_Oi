/**
 * ZARA — shared types for the command router, tool layer and activity log.
 */

/** Every intent ZARA can route. Extend this union to add new capabilities. */
export type ZaraIntent =
  | 'OPEN_WEBSITE'
  | 'SEARCH_WEB'
  | 'SEARCH_YOUTUBE'
  | 'BROWSER_BACK'
  | 'BROWSER_FORWARD'
  | 'NEW_TAB'
  | 'CLOSE_TAB'
  | 'REFRESH_PAGE'
  | 'GET_TIME'
  | 'GET_DATE'
  | 'GENERAL_CONVERSATION'
  | 'SAVE_MEMORY'
  | 'RECALL_MEMORY'
  | 'SCREEN_ANALYSIS'
  | 'CAMERA_ANALYSIS'
  | 'OPEN_APPLICATION'
  | 'CLOSE_APPLICATION'
  | 'SYSTEM_ACTION'
  | 'STOP_SPEAKING'
  | 'UNKNOWN'

/**
 * The honest outcome of an action. ZARA must report these truthfully —
 * she may never say "Done" for anything that is not SUCCESS.
 */
export type ActionStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'PERMISSION_REQUIRED'
  | 'NOT_CONNECTED'
  | 'UNSUPPORTED'
  | 'CONFIRMATION_REQUIRED'

export interface ActionResult {
  status: ActionStatus
  /** Short factual sentence describing what actually happened. */
  message: string
  /** Structured payload handed back to the AI as tool output. */
  data?: unknown
  /** Present when status is not SUCCESS. Never contains secrets. */
  error?: string
}

export const ok = (message: string, data?: unknown): ActionResult => ({
  status: 'SUCCESS',
  message,
  data,
})

export const fail = (
  message: string,
  status: Exclude<ActionStatus, 'SUCCESS'> = 'FAILED',
  error?: string
): ActionResult => ({ status, message, error: error ?? message })

/** Where a request came from. Voice and text share one pipeline. */
export type RequestSource = 'VOICE' | 'TEXT'

/** A parsed command produced by the router. */
export interface RoutedCommand {
  intent: ZaraIntent
  /** Original utterance, wake word stripped. */
  utterance: string
  /** Intent-specific parsed slots. */
  slots: Record<string, string>
  /**
   * true when the router is confident enough to execute the action directly
   * without a round trip to the LLM. Keeps core commands working offline and
   * before any API key is configured.
   */
  deterministic: boolean
  /** true when the action is destructive and needs explicit confirmation. */
  requiresConfirmation: boolean
}

/** ZARA's presentation / expression states. Drives avatar + UI, not a claim of feelings. */
export type ZaraPresentationState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'EXECUTING'
  | 'HAPPY'
  | 'CURIOUS'
  | 'EXCITED'
  | 'CALM'
  | 'CONCERNED'
  | 'ERROR'

/** Resources ZARA must hold explicit permission for. */
export type ZaraPermission =
  | 'microphone'
  | 'camera'
  | 'screen'
  | 'browser'
  | 'computer'
  | 'files'
  | 'notifications'

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable'
