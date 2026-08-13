/**
 * ZARA — secure configuration loader (MAIN PROCESS ONLY).
 *
 * Credential precedence:
 *   1. Encrypted settings store (what the user typed in Settings, protected
 *      by Electron safeStorage).
 *   2. Process environment / `.env` file.
 *
 * Hard rules enforced here:
 *   - The raw key NEVER leaves the main process.
 *   - The renderer only ever receives { hasApiKey, maskedKey, provider, model }.
 *   - The key is never written to a log line.
 */

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { loadSettings } from './settingsManager'

export interface ZaraAIConfig {
  provider: string
  model: string
  baseUrl: string
  /** Present only inside the main process. */
  apiKey: string
}

/** Safe-to-expose view of the AI configuration. */
export interface PublicAIConfig {
  provider: string
  model: string
  baseUrl: string
  hasApiKey: boolean
  /** Fixed-length mask — never derived from the real key's length. */
  maskedKey: string
  source: 'settings' | 'env' | 'none'
}

const MASK = '••••••••••••••••'

let envLoaded = false

/**
 * Minimal .env parser. Avoids adding a runtime dependency and never logs
 * values. Existing process.env entries always win.
 */
function loadDotEnv(): void {
  if (envLoaded) return
  envLoaded = true

  const candidates = [
    path.join(process.cwd(), '.env'),
    app.isPackaged ? path.join(path.dirname(app.getPath('exe')), '.env') : '',
    path.join(app.getPath('userData'), '.env'),
  ].filter(Boolean) as string[]

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue
      const contents = fs.readFileSync(file, 'utf8')
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (key && process.env[key] === undefined) {
          process.env[key] = value
        }
      }
      console.log(
        `[ZaraConfig] Loaded environment file: ${path.basename(file)}`
      )
    } catch {
      // A malformed .env must never prevent startup.
    }
  }
}

/** Values that mean "the user has not filled this in yet". */
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true
  const normalized = value.trim()
  if (!normalized) return true
  return (
    /^your_.*_here$/i.test(normalized) ||
    /^(placeholder|changeme|todo|xxx+|none|null|undefined)$/i.test(normalized)
  )
}

/** Reads a usable (non-placeholder) env var. */
function envValue(...names: string[]): string {
  loadDotEnv()
  for (const name of names) {
    const value = process.env[name]
    if (!isPlaceholder(value)) return (value as string).trim()
  }
  return ''
}

/** Maps a provider id to the settings key holding its stored secret. */
function settingsKeyForProvider(provider: string): string {
  switch (provider) {
    case 'openrouter':
      return 'VITE_OPENROUTER_API_KEY'
    case 'deepseek':
      return 'VITE_DEEPSEEK_API_KEY'
    case 'zai':
      return 'VITE_ZAI_API_KEY'
    case 'minimax':
      return 'VITE_MINIMAX_API_KEY'
    case 'openai':
    default:
      return 'VITE_OPENAI_API_KEY'
  }
}

/**
 * Resolves the effective AI configuration. Returns the raw key — callers must
 * keep it inside the main process.
 */
export async function resolveAIConfig(): Promise<
  ZaraAIConfig & { source: PublicAIConfig['source'] }
> {
  loadDotEnv()

  let stored: Record<string, any> = {}
  try {
    stored = (await loadSettings()) || {}
  } catch {
    stored = {}
  }

  const provider = stored.aiProvider || envValue('AI_PROVIDER') || 'openai'
  const model = stored.assistantModel || envValue('AI_MODEL') || ''
  const baseUrl =
    stored.aiBaseUrl ||
    stored[`${provider}BaseUrl`] ||
    envValue('AI_BASE_URL') ||
    ''

  const settingsKey = settingsKeyForProvider(provider)
  const fromSettings = stored[settingsKey]

  if (!isPlaceholder(fromSettings)) {
    return {
      provider,
      model,
      baseUrl,
      apiKey: String(fromSettings).trim(),
      source: 'settings',
    }
  }

  const fromEnv = envValue('AI_API_KEY', settingsKey)
  if (fromEnv) {
    return { provider, model, baseUrl, apiKey: fromEnv, source: 'env' }
  }

  return { provider, model, baseUrl, apiKey: '', source: 'none' }
}

/**
 * The ONLY AI-config shape the renderer is ever allowed to see.
 */
export async function getPublicAIConfig(): Promise<PublicAIConfig> {
  const config = await resolveAIConfig()
  const localProvider =
    config.provider === 'ollama' || config.provider === 'lm-studio'

  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    hasApiKey: localProvider ? Boolean(config.baseUrl) : Boolean(config.apiKey),
    maskedKey: config.apiKey ? MASK : '',
    source: config.source,
  }
}

/** Public, non-secret view of every configured integration. */
export async function getConfigSummary() {
  const ai = await getPublicAIConfig()
  return {
    ai,
    bridgePort: Number(envValue('ZARA_BRIDGE_PORT')) || 5421,
    sttProvider: envValue('STT_PROVIDER') || 'local',
    ttsProvider: envValue('TTS_PROVIDER') || 'local',
  }
}

export { isPlaceholder, MASK }
