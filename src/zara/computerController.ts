/**
 * ZARA — computer control.
 *
 * Deliberately NOT a shell passthrough. The AI can only choose from a fixed
 * catalogue of named applications and actions; it can never assemble an
 * arbitrary command string. Anything outside the catalogue is UNSUPPORTED.
 */

import type { ActionResult } from './types'
import { ok, fail } from './types'

/** Per-platform launch targets for each canonical app id. */
const APP_TARGETS: Record<
  string,
  { win32?: string; darwin?: string; linux?: string; label: string }
> = {
  chrome: {
    label: 'Google Chrome',
    win32: 'chrome',
    darwin: 'Google Chrome',
    linux: 'google-chrome',
  },
  firefox: {
    label: 'Firefox',
    win32: 'firefox',
    darwin: 'Firefox',
    linux: 'firefox',
  },
  edge: {
    label: 'Microsoft Edge',
    win32: 'msedge',
    darwin: 'Microsoft Edge',
    linux: 'microsoft-edge',
  },
  vscode: {
    label: 'VS Code',
    win32: 'code',
    darwin: 'Visual Studio Code',
    linux: 'code',
  },
  calculator: {
    label: 'Calculator',
    win32: 'calc',
    darwin: 'Calculator',
    linux: 'gnome-calculator',
  },
  notepad: {
    label: 'Notepad',
    win32: 'notepad',
    darwin: 'TextEdit',
    linux: 'gedit',
  },
  terminal: {
    label: 'Terminal',
    win32: 'cmd',
    darwin: 'Terminal',
    linux: 'gnome-terminal',
  },
  files: {
    label: 'File manager',
    win32: 'explorer',
    darwin: 'Finder',
    linux: 'nautilus',
  },
  spotify: {
    label: 'Spotify',
    win32: 'spotify',
    darwin: 'Spotify',
    linux: 'spotify',
  },
  settings: {
    label: 'System settings',
    win32: 'ms-settings:',
    darwin: 'System Settings',
    linux: 'gnome-control-center',
  },
}

function hasIPC(): boolean {
  return typeof window !== 'undefined' && Boolean(window.aliceIPC)
}

export function knownAppIds(): string[] {
  return Object.keys(APP_TARGETS)
}

export function appLabel(appId: string): string {
  return APP_TARGETS[appId]?.label ?? appId
}

/**
 * Launches a whitelisted application through the main process.
 */
export async function openApplication(appId: string): Promise<ActionResult> {
  const entry = APP_TARGETS[appId]
  if (!entry) {
    return fail(
      `I don't have "${appId}" in my list of launchable apps.`,
      'UNSUPPORTED'
    )
  }
  if (!hasIPC()) {
    return fail('Launching apps needs the desktop app.', 'UNSUPPORTED')
  }

  try {
    const result = await window.aliceIPC.invoke('zara:open-application', {
      appId,
    })
    if (result?.success) {
      return ok(`Opened ${entry.label}.`, { appId, label: entry.label })
    }
    if (result?.reason === 'not-found') {
      return fail(
        `${entry.label} doesn't seem to be installed.`,
        'FAILED',
        result?.error
      )
    }
    return fail(
      `I couldn't open ${entry.label}.`,
      'FAILED',
      result?.error || 'Unknown launch error.'
    )
  } catch (error: any) {
    return fail(`I couldn't open ${entry.label}.`, 'FAILED', error?.message)
  }
}

/**
 * Closes a whitelisted application. Treated as a sensitive action by the
 * router (unsaved work) so it is confirmed before reaching here.
 */
export async function closeApplication(appId: string): Promise<ActionResult> {
  const entry = APP_TARGETS[appId]
  if (!entry) {
    return fail(
      `I don't have "${appId}" in my list of manageable apps.`,
      'UNSUPPORTED'
    )
  }
  if (!hasIPC()) {
    return fail('Closing apps needs the desktop app.', 'UNSUPPORTED')
  }

  try {
    const result = await window.aliceIPC.invoke('zara:close-application', {
      appId,
    })
    if (result?.success) {
      return ok(`Closed ${entry.label}.`, { appId })
    }
    if (result?.reason === 'not-running') {
      return fail(`${entry.label} isn't running.`, 'FAILED', result?.error)
    }
    return fail(`I couldn't close ${entry.label}.`, 'FAILED', result?.error)
  } catch (error: any) {
    return fail(`I couldn't close ${entry.label}.`, 'FAILED', error?.message)
  }
}

/** A small set of safe, named system actions. No free-form commands. */
export async function systemAction(action: string): Promise<ActionResult> {
  if (!hasIPC()) {
    return fail('System actions need the desktop app.', 'UNSUPPORTED')
  }

  const supported = ['switch_window']
  if (!supported.includes(action)) {
    return fail(`I can't perform "${action}" yet.`, 'UNSUPPORTED')
  }

  try {
    const result = await window.aliceIPC.invoke('zara:system-action', {
      action,
    })
    if (result?.success) {
      return ok(result.message || 'Done.', result.data)
    }
    return fail(
      result?.message || `That system action isn't available on this platform.`,
      result?.reason === 'unsupported' ? 'UNSUPPORTED' : 'FAILED',
      result?.error
    )
  } catch (error: any) {
    return fail(`That system action failed.`, 'FAILED', error?.message)
  }
}
