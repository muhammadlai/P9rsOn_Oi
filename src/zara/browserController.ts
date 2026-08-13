/**
 * ZARA — browser control.
 *
 * Two-tier architecture, because a renderer cannot drive a real browser:
 *
 *  1. OPEN / SEARCH — handled by the Electron main process via `shell.openExternal`.
 *     This genuinely opens the user's default browser. Always available.
 *
 *  2. TAB CONTROL (back / forward / refresh / new tab / close tab) — impossible
 *     from outside the browser for security reasons. These are relayed over the
 *     local WebSocket bridge to the ZARA browser extension. When the extension
 *     is not connected we report NOT_CONNECTED — we never fake success.
 */

import type { ActionResult } from './types'
import { ok, fail } from './types'

type BridgeCommand =
  'browser_back' | 'browser_forward' | 'refresh_page' | 'new_tab' | 'close_tab'

const BRIDGE_TIMEOUT_MESSAGE =
  'Browser control is not connected. Install and enable the ZARA browser extension to control tabs.'

function hasIPC(): boolean {
  return typeof window !== 'undefined' && Boolean(window.aliceIPC)
}

/**
 * Opens a URL in the user's real default browser through the main process.
 */
export async function openUrl(url: string): Promise<ActionResult> {
  if (!hasIPC()) {
    return fail(
      'Opening websites needs the desktop app.',
      'UNSUPPORTED',
      'IPC bridge unavailable outside Electron.'
    )
  }

  let safeUrl: string
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fail(
        `I can only open web links, not ${parsed.protocol} URLs.`,
        'UNSUPPORTED'
      )
    }
    safeUrl = parsed.toString()
  } catch {
    return fail(`"${url}" isn't a valid web address.`, 'FAILED')
  }

  try {
    const result = await window.aliceIPC.invoke('electron:open-path', {
      target: safeUrl,
    })
    if (result?.success) {
      return ok(`Opened ${safeUrl}`, { url: safeUrl })
    }
    return fail(
      `I couldn't open that link.`,
      'FAILED',
      result?.message || 'Unknown error from open-path.'
    )
  } catch (error: any) {
    return fail(`I couldn't open that link.`, 'FAILED', error?.message)
  }
}

/** Opens a Google search for the given query in the real browser. */
export async function searchWeb(query: string): Promise<ActionResult> {
  const trimmed = (query || '').trim()
  if (!trimmed) return fail('I need something to search for.', 'FAILED')

  const url = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  const result = await openUrl(url)
  return result.status === 'SUCCESS'
    ? ok(`Searched the web for "${trimmed}".`, { query: trimmed, url })
    : result
}

/** Opens a YouTube search for the given query in the real browser. */
export async function searchYouTube(query: string): Promise<ActionResult> {
  const trimmed = (query || '').trim()
  if (!trimmed)
    return fail('I need something to search for on YouTube.', 'FAILED')

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`
  const result = await openUrl(url)
  return result.status === 'SUCCESS'
    ? ok(`Searched YouTube for "${trimmed}".`, { query: trimmed, url })
    : result
}

/**
 * Sends a tab-control command to the browser extension over the local bridge.
 * Returns NOT_CONNECTED (never a fake success) when no extension is attached.
 */
export async function sendBridgeCommand(
  command: BridgeCommand,
  payload: Record<string, unknown> = {}
): Promise<ActionResult> {
  if (!hasIPC()) {
    return fail(BRIDGE_TIMEOUT_MESSAGE, 'NOT_CONNECTED')
  }

  const requestData = {
    type: 'browser_command',
    command,
    requestId: `zara_${command}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    payload,
  }

  try {
    const result = await window.aliceIPC.invoke(
      'websocket:send-request',
      requestData
    )

    if (result?.success) {
      const detail =
        result.data?.message || `Browser command ${command} completed.`
      return ok(detail, result.data)
    }

    const error: string = result?.error || 'Unknown bridge error.'
    if (/no websocket clients|not connected|timed out/i.test(error)) {
      return fail(BRIDGE_TIMEOUT_MESSAGE, 'NOT_CONNECTED', error)
    }
    return fail(`The browser rejected that action.`, 'FAILED', error)
  } catch (error: any) {
    return fail(BRIDGE_TIMEOUT_MESSAGE, 'NOT_CONNECTED', error?.message)
  }
}

export const browserBack = () => sendBridgeCommand('browser_back')
export const browserForward = () => sendBridgeCommand('browser_forward')
export const refreshPage = () => sendBridgeCommand('refresh_page')
export const closeTab = () => sendBridgeCommand('close_tab')

/**
 * Opens a new tab. With the extension we open a real new tab in the focused
 * window; without it we fall back to launching the default browser, which is a
 * genuine (if coarser) new tab rather than a pretend one.
 */
export async function newTab(url?: string): Promise<ActionResult> {
  const bridged = await sendBridgeCommand('new_tab', url ? { url } : {})
  if (bridged.status === 'SUCCESS') return bridged

  if (bridged.status === 'NOT_CONNECTED') {
    const fallback = await openUrl(url || 'https://www.google.com')
    if (fallback.status === 'SUCCESS') {
      return ok('Opened a new tab in your browser.', fallback.data)
    }
    return fallback
  }
  return bridged
}

/** Reports whether the browser extension bridge currently has a client. */
export async function bridgeStatus(): Promise<'connected' | 'disconnected'> {
  if (!hasIPC()) return 'disconnected'
  try {
    const result = await window.aliceIPC.invoke('websocket:bridge-status')
    return result?.connected ? 'connected' : 'disconnected'
  } catch {
    return 'disconnected'
  }
}
