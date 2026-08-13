/**
 * ZARA — deterministic intent parser.
 *
 * Recognises the core command set locally, before any LLM call. This is what
 * lets "Zara, open Google" work instantly, offline, and even while the AI API
 * is unconfigured. Anything it cannot classify falls through to
 * GENERAL_CONVERSATION and is handled by the AI brain.
 */

import type { RoutedCommand, ZaraIntent } from './types'
import { WAKE_WORD_PREFIXES } from './identity'

/** Well-known sites Aitzaz can open by name. */
export const KNOWN_SITES: Record<string, string> = {
  google: 'https://www.google.com',
  youtube: 'https://www.youtube.com',
  gmail: 'https://mail.google.com',
  chatgpt: 'https://chat.openai.com',
  github: 'https://github.com',
  maps: 'https://maps.google.com',
  'google maps': 'https://maps.google.com',
  drive: 'https://drive.google.com',
  'google drive': 'https://drive.google.com',
  facebook: 'https://www.facebook.com',
  instagram: 'https://www.instagram.com',
  twitter: 'https://twitter.com',
  x: 'https://twitter.com',
  linkedin: 'https://www.linkedin.com',
  reddit: 'https://www.reddit.com',
  whatsapp: 'https://web.whatsapp.com',
  netflix: 'https://www.netflix.com',
  wikipedia: 'https://www.wikipedia.org',
  amazon: 'https://www.amazon.com',
  stackoverflow: 'https://stackoverflow.com',
  'stack overflow': 'https://stackoverflow.com',
}

/** Applications openable by friendly name, per platform. */
export const KNOWN_APPS: Record<string, string> = {
  chrome: 'chrome',
  'google chrome': 'chrome',
  firefox: 'firefox',
  edge: 'edge',
  'vs code': 'vscode',
  vscode: 'vscode',
  'visual studio code': 'vscode',
  code: 'vscode',
  calculator: 'calculator',
  notepad: 'notepad',
  terminal: 'terminal',
  'command prompt': 'terminal',
  cmd: 'terminal',
  explorer: 'files',
  'file explorer': 'files',
  finder: 'files',
  files: 'files',
  spotify: 'spotify',
  settings: 'settings',
}

/** Verbs meaning "delete/destroy" — these force a confirmation step. */
const DESTRUCTIVE_PATTERNS = [
  /\bdelete\b/,
  /\bremove\b/,
  /\berase\b/,
  /\bwipe\b/,
  /\bformat\b/,
  /\buninstall\b/,
  /\bshut\s*down\b/,
  /\brestart\s+(?:the\s+)?(?:pc|computer|system)\b/,
  /\bsend\s+(?:an?\s+)?(?:email|mail|message)\b/,
  /\bbuy\b/,
  /\bpurchase\b/,
  /\bpay\b/,
  /\bchange\s+(?:my\s+)?password\b/,
  /\bclear\s+(?:all\s+)?(?:data|memory|memories)\b/,
  /\bforget\s+everything\b/,
  /\bmita\s*do\b/,
  /\bdelete\s+kar\b/,
]

export interface WakeWordMatch {
  /** true when the utterance began with the wake word. */
  detected: boolean
  /** Utterance with the wake word prefix stripped. */
  command: string
  /** true when the wake word was said alone with no trailing command. */
  bareWake: boolean
}

/**
 * Detects the "Zara" / "Hey Zara" wake word at the start of an utterance and
 * returns the remaining command.
 */
export function matchWakeWord(raw: string): WakeWordMatch {
  const text = (raw || '').trim()
  if (!text) return { detected: false, command: '', bareWake: false }

  const lower = text.toLowerCase()

  // Longest prefix first so "hey zara" wins over "zara".
  const prefixes = [...WAKE_WORD_PREFIXES].sort((a, b) => b.length - a.length)

  for (const prefix of prefixes) {
    if (!lower.startsWith(prefix)) continue
    const rest = text.slice(prefix.length)
    // Require a word boundary so "zaragoza" never triggers the wake word.
    if (rest && /[a-z0-9]/i.test(rest[0])) continue

    const command = rest.replace(/^[\s,.!?:;-]+/, '').trim()
    return { detected: true, command, bareWake: command.length === 0 }
  }

  return { detected: false, command: text, bareWake: false }
}

function isDestructive(text: string): boolean {
  return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(text))
}

/** Resolves a spoken site name (or bare domain) to a URL. */
export function resolveSite(name: string): string | null {
  const key = name
    .toLowerCase()
    .trim()
    .replace(/[.?!]+$/, '')
  if (!key) return null
  if (KNOWN_SITES[key]) return KNOWN_SITES[key]

  const withoutCom = key.replace(/\s*\.\s*com$/, '')
  if (KNOWN_SITES[withoutCom]) return KNOWN_SITES[withoutCom]

  // Already a URL.
  if (/^https?:\/\//i.test(key)) return key
  // Bare domain like "example.com" or "docs.rs".
  if (/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/i.test(key.replace(/\s/g, ''))) {
    return `https://${key.replace(/\s/g, '')}`
  }
  return null
}

/** Resolves a spoken application name to a canonical app id. */
export function resolveApp(name: string): string | null {
  const key = name
    .toLowerCase()
    .trim()
    .replace(/[.?!]+$/, '')
  return KNOWN_APPS[key] ?? null
}

function build(
  intent: ZaraIntent,
  utterance: string,
  slots: Record<string, string> = {},
  deterministic = true
): RoutedCommand {
  return {
    intent,
    utterance,
    slots,
    deterministic,
    requiresConfirmation: isDestructive(utterance.toLowerCase()),
  }
}

/**
 * Classifies an utterance into an intent. Handles English plus common
 * Roman-Urdu phrasings ("kholo", "band karo", "dhundo").
 */
export function parseIntent(rawUtterance: string): RoutedCommand {
  const utterance = (rawUtterance || '').trim()
  const text = utterance
    .toLowerCase()
    .replace(/[.!]+$/, '')
    .trim()

  if (!text) return build('UNKNOWN', utterance, {}, false)

  // ---- Interruption -------------------------------------------------
  if (/^(stop|stop it|be quiet|quiet|shut up|cancel|ruko|chup)\b/.test(text)) {
    return build('STOP_SPEAKING', utterance)
  }

  // ---- Time / date --------------------------------------------------
  if (
    /\b(what(?:'s| is)? the time|what time is it|current time|time kya|kitne baje)\b/.test(
      text
    )
  ) {
    return build('GET_TIME', utterance)
  }
  if (
    /\b(what(?:'s| is)? (?:the )?date|what day is it|today's date|aaj ki tareekh|aaj kaun sa din)\b/.test(
      text
    )
  ) {
    return build('GET_DATE', utterance)
  }

  // ---- Browser navigation -------------------------------------------
  if (
    /^(go back|back|browser back|navigate back|wapas jao|peeche jao)\b/.test(
      text
    )
  ) {
    return build('BROWSER_BACK', utterance)
  }
  if (
    /^(go forward|forward|browser forward|navigate forward|aage jao)\b/.test(
      text
    )
  ) {
    return build('BROWSER_FORWARD', utterance)
  }
  if (
    /\b(refresh|reload)\b.*\b(page|tab|this)?\b/.test(text) &&
    /\b(refresh|reload)\b/.test(text)
  ) {
    return build('REFRESH_PAGE', utterance)
  }
  if (/\b(open|new)\b.*\bnew tab\b|^new tab$|\bnaya tab\b/.test(text)) {
    return build('NEW_TAB', utterance)
  }
  if (/\bclose\b.*\b(this )?tab\b|\btab band\b/.test(text)) {
    return build('CLOSE_TAB', utterance)
  }

  // ---- Combined "open X and search for Y" ---------------------------
  const combined = text.match(
    /^(?:open|launch|go to)\s+(.+?)\s+(?:and|then)\s+(?:search|find|look)\s+(?:for\s+|up\s+)?(.+)$/
  )
  if (combined) {
    const site = combined[1].trim()
    const query = combined[2].trim()
    if (/youtube/.test(site)) {
      return build('SEARCH_YOUTUBE', utterance, { query })
    }
    const url = resolveSite(site)
    if (url) return build('SEARCH_WEB', utterance, { query, site })
  }

  // ---- YouTube search -----------------------------------------------
  const ytSearch =
    text.match(
      /^(?:search|find|look for|play)\s+(?:on\s+)?youtube\s+(?:for\s+)?(.+)$/
    ) ||
    text.match(/^(?:search|find|look)\s+(?:for\s+)?(.+?)\s+on\s+youtube$/) ||
    text.match(/^youtube\s+(?:par\s+)?(.+?)\s*(?:dhundo|search karo)$/)
  if (ytSearch) {
    return build('SEARCH_YOUTUBE', utterance, { query: ytSearch[1].trim() })
  }

  // ---- Web search ----------------------------------------------------
  const webSearch =
    text.match(
      /^(?:search|google|look up|find)\s+(?:google\s+)?(?:for\s+|up\s+)?(.+)$/
    ) || text.match(/^(.+?)\s+(?:google (?:par|pe) )?(?:search karo|dhundo)$/)
  if (webSearch) {
    const query = webSearch[1]
      .replace(/^(?:on|in)\s+(?:google|the web|internet)\s+/i, '')
      .replace(/\s+(?:on|in)\s+(?:google|the web|internet)$/i, '')
      .trim()
    if (query) return build('SEARCH_WEB', utterance, { query })
  }

  // ---- Screen / camera ------------------------------------------------
  if (
    /\b(what(?:'s| is) on my screen|read (?:my|the) screen|read this page|analyse my screen|analyze my screen|explain what i'?m looking at|show me my screen|screen (?:par kya|pe kya))\b/.test(
      text
    )
  ) {
    return build('SCREEN_ANALYSIS', utterance)
  }
  if (
    /\b(take a screenshot|screenshot lo|capture (?:my |the )?screen)\b/.test(
      text
    )
  ) {
    return build('SCREEN_ANALYSIS', utterance, { captureOnly: 'true' })
  }
  if (
    /\b(what do you see|look at this|what is this|read this|explain this image|camera on|dekho ye kya hai)\b/.test(
      text
    )
  ) {
    return build('CAMERA_ANALYSIS', utterance)
  }

  // ---- Memory ----------------------------------------------------------
  const remember = text.match(
    /^(?:remember|note|save|yaad rakho)\s+(?:that\s+)?(.+)$/
  )
  if (remember) {
    return build('SAVE_MEMORY', utterance, { content: remember[1].trim() })
  }
  if (
    /\b(what do you remember|what do you know about me|recall|tumhe kya yaad|kya yaad hai)\b/.test(
      text
    )
  ) {
    return build('RECALL_MEMORY', utterance)
  }
  if (/^(?:forget|delete)\s+(?:that|this)\b/.test(text)) {
    return build('SAVE_MEMORY', utterance, { forget: 'true' })
  }

  // ---- Applications -----------------------------------------------------
  const closeApp = text.match(/^(?:close|quit|exit|kill|band karo)\s+(.+)$/)
  if (closeApp) {
    const app = resolveApp(closeApp[1])
    if (app) return build('CLOSE_APPLICATION', utterance, { app })
  }

  const open =
    text.match(/^(?:open|launch|start|run|go to|kholo|khol do)\s+(.+)$/) ||
    text.match(/^(.+?)\s+(?:kholo|khol do|open karo)$/)
  if (open) {
    const target = open[1].replace(/^(?:up\s+)?/, '').trim()

    // Prefer an app match for things like "chrome" / "vs code".
    const app = resolveApp(target)
    const site = resolveSite(target)

    // "open youtube" should open the site, not hunt for an app.
    if (
      site &&
      (!app || /\.(com|org|net|io)/.test(target) || KNOWN_SITES[target])
    ) {
      return build('OPEN_WEBSITE', utterance, { url: site, site: target })
    }
    if (app) return build('OPEN_APPLICATION', utterance, { app, name: target })
    if (site)
      return build('OPEN_WEBSITE', utterance, { url: site, site: target })

    // Unknown target — let the AI decide what he meant.
    return build('UNKNOWN', utterance, { target }, false)
  }

  // ---- System -------------------------------------------------------------
  if (/\b(switch window|next window|alt tab|window badlo)\b/.test(text)) {
    return build('SYSTEM_ACTION', utterance, { action: 'switch_window' })
  }

  return build('GENERAL_CONVERSATION', utterance, {}, false)
}
