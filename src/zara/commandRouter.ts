/**
 * ZARA — central command router.
 *
 * One pipeline for BOTH voice and text:
 *
 *     VOICE ──┐
 *             ├──> ROUTER ──> TOOL ──> HONEST RESULT ──> RESPONSE ──> TTS
 *     TEXT  ──┘
 *
 * Deterministic intents (open site, search, time, tab control, app launch) are
 * executed directly so they work instantly, offline, and before any API key is
 * configured. Everything else is delegated to the AI brain.
 *
 * Add a new capability by adding an intent to `ZaraIntent` and a handler here.
 */

import type {
  ActionResult,
  RequestSource,
  RoutedCommand,
  ZaraIntent,
} from './types'
import { ok, fail } from './types'
import { parseIntent, matchWakeWord } from './intentParser'
import {
  openUrl,
  searchWeb,
  searchYouTube,
  browserBack,
  browserForward,
  refreshPage,
  newTab,
  closeTab,
} from './browserController'
import {
  openApplication,
  closeApplication,
  systemAction,
  appLabel,
} from './computerController'
import { OWNER_NAME_DISPLAY } from './identity'

/** Context carried between turns so follow-ups don't need repeating. */
export interface ConversationContext {
  /** Last site opened, e.g. "youtube" — lets "search for X" target it. */
  lastSite?: string
  lastUrl?: string
  lastIntent?: ZaraIntent
  lastQuery?: string
  updatedAt?: number
}

const CONTEXT_TTL_MS = 5 * 60 * 1000

export interface RouteOutcome {
  command: RoutedCommand
  /** Present when the router executed the action itself. */
  result?: ActionResult
  /** True when the request must go to the AI brain instead. */
  delegateToAI: boolean
  /** Spoken reply when the router handled it end to end. */
  reply?: string
}

/** Hooks the caller supplies so the router stays UI-agnostic and testable. */
export interface RouterHooks {
  getContext: () => ConversationContext
  setContext: (patch: Partial<ConversationContext>) => void
  onIntent?: (command: RoutedCommand) => void
  onResult?: (intent: ZaraIntent, result: ActionResult) => void
  /** Asks the user to confirm a destructive action. */
  confirm?: (question: string) => Promise<boolean>
  /** Stops any in-flight speech. */
  stopSpeaking?: () => void
  /** Saves a memory; returns true on success. */
  saveMemory?: (content: string) => Promise<boolean>
  /** Recalls memories as short strings. */
  recallMemories?: () => Promise<string[]>
  /** Triggers screen capture + vision analysis. */
  analyseScreen?: () => Promise<ActionResult>
  /** Triggers camera capture + vision analysis. */
  analyseCamera?: () => Promise<ActionResult>
}

function contextIsFresh(context: ConversationContext): boolean {
  if (!context.updatedAt) return false
  return Date.now() - context.updatedAt < CONTEXT_TTL_MS
}

function formatTime(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Turns an action result into something ZARA can honestly say out loud.
 * SUCCESS gets a natural confirmation; everything else states the real problem.
 */
export function speakResult(intent: ZaraIntent, result: ActionResult): string {
  if (result.status === 'SUCCESS') {
    switch (intent) {
      case 'OPEN_WEBSITE':
        return `${result.message} What would you like to do?`
      case 'SEARCH_WEB':
      case 'SEARCH_YOUTUBE':
        return 'Done.'
      default:
        return result.message
    }
  }

  switch (result.status) {
    case 'NOT_CONNECTED':
      return result.message
    case 'PERMISSION_REQUIRED':
      return result.message
    case 'UNSUPPORTED':
      return result.message
    default:
      return result.message
  }
}

export class CommandRouter {
  private hooks: RouterHooks

  constructor(hooks: RouterHooks) {
    this.hooks = hooks
  }

  /**
   * Strips the wake word and classifies the utterance, applying conversation
   * context so follow-ups like "search for AI news" inherit the last site.
   */
  parse(rawUtterance: string): RoutedCommand {
    const wake = matchWakeWord(rawUtterance)
    const command = parseIntent(wake.command || rawUtterance)

    // Bare "Zara" — she should acknowledge and keep listening.
    if (wake.bareWake) {
      return {
        intent: 'GENERAL_CONVERSATION',
        utterance: rawUtterance,
        slots: { bareWake: 'true' },
        deterministic: true,
        requiresConfirmation: false,
      }
    }

    // Context inheritance: a bare web search right after opening YouTube
    // should search YouTube, not Google.
    const context = this.hooks.getContext()
    if (
      command.intent === 'SEARCH_WEB' &&
      contextIsFresh(context) &&
      context.lastSite === 'youtube' &&
      !/\bgoogle\b/i.test(command.utterance)
    ) {
      return { ...command, intent: 'SEARCH_YOUTUBE' }
    }

    return command
  }

  /**
   * Routes and, where deterministic, executes the command.
   */
  async route(
    rawUtterance: string,
    _source: RequestSource = 'TEXT'
  ): Promise<RouteOutcome> {
    const command = this.parse(rawUtterance)
    this.hooks.onIntent?.(command)

    // Bare wake word: acknowledge, stay listening.
    if (command.slots.bareWake === 'true') {
      return {
        command,
        delegateToAI: false,
        reply: `Yes, ${OWNER_NAME_DISPLAY}. I'm listening.`,
        result: ok('Acknowledged wake word.'),
      }
    }

    // Destructive actions need an explicit yes first. This gate runs BEFORE
    // delegation as well, so a destructive request never reaches the AI tool
    // layer unconfirmed just because the router could not classify it.
    if (command.requiresConfirmation) {
      const question = 'This action requires confirmation. Continue?'
      const confirmed = this.hooks.confirm
        ? await this.hooks.confirm(question)
        : false
      if (!confirmed) {
        const result = fail('Cancelled — I did not make any changes.', 'FAILED')
        this.hooks.onResult?.(command.intent, result)
        return { command, result, delegateToAI: false, reply: result.message }
      }
    }

    // Non-deterministic intents go to the AI brain.
    if (!command.deterministic) {
      return { command, delegateToAI: true }
    }

    const result = await this.execute(command)
    this.hooks.onResult?.(command.intent, result)

    return {
      command,
      result,
      delegateToAI: false,
      reply: speakResult(command.intent, result),
    }
  }

  /** Executes a single routed command against the real tool layer. */
  private async execute(command: RoutedCommand): Promise<ActionResult> {
    const { intent, slots } = command

    switch (intent) {
      case 'OPEN_WEBSITE': {
        const result = await openUrl(slots.url)
        if (result.status === 'SUCCESS') {
          this.hooks.setContext({
            lastSite: slots.site,
            lastUrl: slots.url,
            lastIntent: intent,
            updatedAt: Date.now(),
          })
          const name = slots.site
            ? slots.site.charAt(0).toUpperCase() + slots.site.slice(1)
            : 'The site'
          return ok(`${name} is open.`, result.data)
        }
        return result
      }

      case 'SEARCH_WEB': {
        const result = await searchWeb(slots.query)
        if (result.status === 'SUCCESS') {
          this.hooks.setContext({
            lastQuery: slots.query,
            lastIntent: intent,
            updatedAt: Date.now(),
          })
        }
        return result
      }

      case 'SEARCH_YOUTUBE': {
        const result = await searchYouTube(slots.query)
        if (result.status === 'SUCCESS') {
          this.hooks.setContext({
            lastSite: 'youtube',
            lastQuery: slots.query,
            lastIntent: intent,
            updatedAt: Date.now(),
          })
        }
        return result
      }

      case 'BROWSER_BACK':
        return browserBack()
      case 'BROWSER_FORWARD':
        return browserForward()
      case 'REFRESH_PAGE':
        return refreshPage()
      case 'NEW_TAB':
        return newTab(slots.url)
      case 'CLOSE_TAB':
        return closeTab()

      case 'GET_TIME':
        return ok(`It's ${formatTime()}.`)
      case 'GET_DATE':
        return ok(`Today is ${formatDate()}.`)

      case 'OPEN_APPLICATION': {
        const result = await openApplication(slots.app)
        if (result.status === 'SUCCESS') {
          this.hooks.setContext({ lastIntent: intent, updatedAt: Date.now() })
        }
        return result
      }

      case 'CLOSE_APPLICATION':
        return closeApplication(slots.app)

      case 'SYSTEM_ACTION':
        return systemAction(slots.action)

      case 'STOP_SPEAKING':
        this.hooks.stopSpeaking?.()
        return ok('Stopped.')

      case 'SAVE_MEMORY': {
        if (slots.forget === 'true') {
          // Deleting a specific memory needs the AI to identify which one.
          return fail('Let me check which memory you mean.', 'UNSUPPORTED')
        }
        if (!this.hooks.saveMemory) {
          return fail('Memory storage is unavailable.', 'UNSUPPORTED')
        }
        const saved = await this.hooks.saveMemory(slots.content)
        return saved
          ? ok(`Saved. I'll remember that.`)
          : fail(`I couldn't save that memory.`, 'FAILED')
      }

      case 'RECALL_MEMORY': {
        if (!this.hooks.recallMemories) {
          return fail('Memory recall is unavailable.', 'UNSUPPORTED')
        }
        const memories = await this.hooks.recallMemories()
        if (!memories.length) {
          return ok(`I don't have anything saved about you yet.`, { memories })
        }
        return ok(memories.join(' '), { memories })
      }

      case 'SCREEN_ANALYSIS': {
        if (!this.hooks.analyseScreen) {
          return fail('Screen analysis is unavailable.', 'UNSUPPORTED')
        }
        return this.hooks.analyseScreen()
      }

      case 'CAMERA_ANALYSIS': {
        if (!this.hooks.analyseCamera) {
          return fail('Camera analysis is unavailable.', 'UNSUPPORTED')
        }
        return this.hooks.analyseCamera()
      }

      default:
        return fail(`I'm not sure how to do that yet.`, 'UNSUPPORTED')
    }
  }
}

export { appLabel }
