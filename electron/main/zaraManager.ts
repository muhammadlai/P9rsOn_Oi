/**
 * ZARA — computer control + AI connection testing (MAIN PROCESS).
 *
 * Exposes a *fixed catalogue* of launchable applications. The renderer (and
 * therefore the AI) can only pass an app id from this catalogue — it can never
 * supply a raw command string, so a prompt injection cannot execute arbitrary
 * code through this surface.
 */

import { ipcMain, shell } from 'electron'
import { exec, spawn } from 'node:child_process'
import {
  resolveAIConfig,
  getPublicAIConfig,
  getConfigSummary,
} from './zaraConfig'

interface AppSpec {
  label: string
  win32?: { command: string; args?: string[]; uri?: boolean }
  darwin?: { appName: string }
  linux?: { command: string; args?: string[] }
  /** Process names used to close the app, per platform. */
  processNames?: { win32?: string; darwin?: string; linux?: string }
}

/** The complete allowlist. Nothing outside this map can be launched. */
const APP_CATALOGUE: Record<string, AppSpec> = {
  chrome: {
    label: 'Google Chrome',
    win32: { command: 'chrome' },
    darwin: { appName: 'Google Chrome' },
    linux: { command: 'google-chrome' },
    processNames: {
      win32: 'chrome.exe',
      darwin: 'Google Chrome',
      linux: 'chrome',
    },
  },
  firefox: {
    label: 'Firefox',
    win32: { command: 'firefox' },
    darwin: { appName: 'Firefox' },
    linux: { command: 'firefox' },
    processNames: { win32: 'firefox.exe', darwin: 'firefox', linux: 'firefox' },
  },
  edge: {
    label: 'Microsoft Edge',
    win32: { command: 'msedge' },
    darwin: { appName: 'Microsoft Edge' },
    linux: { command: 'microsoft-edge' },
    processNames: {
      win32: 'msedge.exe',
      darwin: 'Microsoft Edge',
      linux: 'microsoft-edge',
    },
  },
  vscode: {
    label: 'VS Code',
    win32: { command: 'code' },
    darwin: { appName: 'Visual Studio Code' },
    linux: { command: 'code' },
    processNames: { win32: 'Code.exe', darwin: 'Code', linux: 'code' },
  },
  calculator: {
    label: 'Calculator',
    win32: { command: 'calc' },
    darwin: { appName: 'Calculator' },
    linux: { command: 'gnome-calculator' },
    processNames: {
      win32: 'CalculatorApp.exe',
      darwin: 'Calculator',
      linux: 'gnome-calculator',
    },
  },
  notepad: {
    label: 'Notepad',
    win32: { command: 'notepad' },
    darwin: { appName: 'TextEdit' },
    linux: { command: 'gedit' },
    processNames: { win32: 'notepad.exe', darwin: 'TextEdit', linux: 'gedit' },
  },
  terminal: {
    label: 'Terminal',
    win32: { command: 'cmd', args: ['/c', 'start', 'cmd'] },
    darwin: { appName: 'Terminal' },
    linux: { command: 'gnome-terminal' },
    processNames: {
      win32: 'cmd.exe',
      darwin: 'Terminal',
      linux: 'gnome-terminal',
    },
  },
  files: {
    label: 'File manager',
    win32: { command: 'explorer' },
    darwin: { appName: 'Finder' },
    linux: { command: 'nautilus' },
  },
  spotify: {
    label: 'Spotify',
    win32: { command: 'spotify' },
    darwin: { appName: 'Spotify' },
    linux: { command: 'spotify' },
    processNames: { win32: 'Spotify.exe', darwin: 'Spotify', linux: 'spotify' },
  },
  settings: {
    label: 'System settings',
    win32: { command: 'ms-settings:', uri: true },
    darwin: { appName: 'System Settings' },
    linux: { command: 'gnome-control-center' },
  },
}

function launchDetached(command: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })
      child.on('error', reject)
      child.unref()
      // spawn() reports ENOENT asynchronously; give it a tick to surface.
      setTimeout(resolve, 150)
    } catch (error) {
      reject(error)
    }
  })
}

async function openApp(appId: string) {
  const spec = APP_CATALOGUE[appId]
  if (!spec) {
    return {
      success: false,
      reason: 'unsupported',
      error: `Unknown app: ${appId}`,
    }
  }

  const platform = process.platform

  try {
    if (platform === 'win32' && spec.win32) {
      if (spec.win32.uri) {
        await shell.openExternal(spec.win32.command)
        return { success: true, label: spec.label }
      }
      // `start` resolves apps on PATH and registered App Paths.
      await new Promise<void>((resolve, reject) => {
        exec(`start "" "${spec.win32!.command}"`, error =>
          error ? reject(error) : resolve()
        )
      })
      return { success: true, label: spec.label }
    }

    if (platform === 'darwin' && spec.darwin) {
      await new Promise<void>((resolve, reject) => {
        exec(`open -a ${JSON.stringify(spec.darwin!.appName)}`, error =>
          error ? reject(error) : resolve()
        )
      })
      return { success: true, label: spec.label }
    }

    if (platform === 'linux' && spec.linux) {
      await launchDetached(spec.linux.command, spec.linux.args)
      return { success: true, label: spec.label }
    }

    return {
      success: false,
      reason: 'unsupported',
      error: `${spec.label} is not mapped for ${platform}.`,
    }
  } catch (error: any) {
    const notFound =
      error?.code === 'ENOENT' ||
      /not found|not recognized/i.test(error?.message || '')
    return {
      success: false,
      reason: notFound ? 'not-found' : 'failed',
      error: error?.message || 'Launch failed.',
    }
  }
}

async function closeApp(appId: string) {
  const spec = APP_CATALOGUE[appId]
  if (!spec?.processNames) {
    return {
      success: false,
      reason: 'unsupported',
      error: `Closing ${appId} is not supported.`,
    }
  }

  const platform = process.platform as 'win32' | 'darwin' | 'linux'
  const processName = spec.processNames[platform]
  if (!processName) {
    return {
      success: false,
      reason: 'unsupported',
      error: `Closing ${spec.label} is not supported on ${platform}.`,
    }
  }

  // Graceful termination only — never a forced kill of arbitrary PIDs.
  const command =
    platform === 'win32'
      ? `taskkill /IM ${JSON.stringify(processName)}`
      : platform === 'darwin'
        ? `osascript -e ${JSON.stringify(`quit app "${processName}"`)}`
        : `pkill -TERM -x ${JSON.stringify(processName)}`

  return new Promise(resolve => {
    exec(command, { timeout: 10_000 }, (error, _stdout, stderr) => {
      if (error) {
        const notRunning = /not found|no process|not running/i.test(
          `${error.message} ${stderr}`
        )
        resolve({
          success: false,
          reason: notRunning ? 'not-running' : 'failed',
          error: notRunning ? `${spec.label} is not running.` : error.message,
        })
        return
      }
      resolve({ success: true, label: spec.label })
    })
  })
}

async function performSystemAction(action: string) {
  if (action !== 'switch_window') {
    return {
      success: false,
      reason: 'unsupported',
      message: `Unknown action: ${action}`,
    }
  }

  const platform = process.platform
  if (platform === 'darwin') {
    return new Promise(resolve => {
      exec(
        `osascript -e 'tell application "System Events" to key code 48 using command down'`,
        error =>
          resolve(
            error
              ? {
                  success: false,
                  reason: 'failed',
                  message: 'Could not switch window.',
                  error: error.message,
                }
              : { success: true, message: 'Switched window.' }
          )
      )
    })
  }

  return {
    success: false,
    reason: 'unsupported',
    message: 'Window switching is not available on this platform yet.',
  }
}

/**
 * Verifies the stored credential by listing models. The key is used only here,
 * inside the main process, and is never returned or logged.
 */
async function testAIConnection() {
  const config = await resolveAIConfig()

  const isLocal =
    config.provider === 'ollama' || config.provider === 'lm-studio'
  if (!config.apiKey && !isLocal) {
    return {
      success: false,
      reason: 'not-configured',
      message: 'AI API NOT CONFIGURED — add your API key in Settings.',
    }
  }

  const endpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1/models',
    openrouter: 'https://openrouter.ai/api/v1/models',
    deepseek: 'https://api.deepseek.com/v1/models',
    zai: 'https://api.z.ai/api/coding/paas/v4/models',
    minimax: 'https://api.minimax.io/v1/models',
  }

  const url =
    (config.baseUrl ? `${config.baseUrl.replace(/\/$/, '')}/models` : '') ||
    endpoints[config.provider]

  if (!url) {
    return {
      success: false,
      reason: 'unsupported',
      message: `Connection testing isn't available for ${config.provider}.`,
    }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    const response = await fetch(url, {
      headers: config.apiKey
        ? { Authorization: `Bearer ${config.apiKey}` }
        : undefined,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (response.ok) {
      return { success: true, message: `Connected to ${config.provider}.` }
    }
    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        reason: 'unauthorized',
        // Deliberately does not echo the key or the response body.
        message: 'The API key was rejected. Check the key in Settings.',
      }
    }
    return {
      success: false,
      reason: 'failed',
      message: `Provider returned HTTP ${response.status}.`,
    }
  } catch (error: any) {
    const aborted = error?.name === 'AbortError'
    return {
      success: false,
      reason: 'failed',
      message: aborted
        ? 'Connection test timed out.'
        : 'Could not reach the AI provider. Check your network.',
    }
  }
}

let registered = false

export function registerZaraIPCHandlers(): void {
  if (registered) return
  registered = true

  ipcMain.handle('zara:open-application', async (_event, args) => {
    const appId = typeof args?.appId === 'string' ? args.appId : ''
    if (!APP_CATALOGUE[appId]) {
      return {
        success: false,
        reason: 'unsupported',
        error: 'Unknown application.',
      }
    }
    console.log(`[Zara] Launching application: ${appId}`)
    return openApp(appId)
  })

  ipcMain.handle('zara:close-application', async (_event, args) => {
    const appId = typeof args?.appId === 'string' ? args.appId : ''
    if (!APP_CATALOGUE[appId]) {
      return {
        success: false,
        reason: 'unsupported',
        error: 'Unknown application.',
      }
    }
    console.log(`[Zara] Closing application: ${appId}`)
    return closeApp(appId)
  })

  ipcMain.handle('zara:system-action', async (_event, args) => {
    const action = typeof args?.action === 'string' ? args.action : ''
    return performSystemAction(action)
  })

  // Returns ONLY the masked, non-secret view of the AI configuration.
  ipcMain.handle('zara:ai-config', async () => getPublicAIConfig())

  ipcMain.handle('zara:config-summary', async () => getConfigSummary())

  ipcMain.handle('zara:ai-test-connection', async () => testAIConnection())

  ipcMain.handle('zara:list-applications', async () =>
    Object.entries(APP_CATALOGUE).map(([id, spec]) => ({
      id,
      label: spec.label,
    }))
  )
}

export { APP_CATALOGUE }
