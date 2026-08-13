/**
 * ZARA AI 2070 — Activity Log.
 *
 * Records important actions (time, user command, AI intent, tool, action,
 * result) so Aitzaz can see what happened. Secret-safe: keys, passwords,
 * tokens and credentials are scrubbed before anything is stored.
 */

export interface ActivityEntry {
  id: string
  /** ISO timestamp */
  time: string
  userCommand: string
  intent: string
  tool: string
  action: string
  result: 'SUCCESS' | 'FAILED' | 'PERMISSION_REQUIRED' | 'NOT_CONNECTED' | 'UNSUPPORTED'
  detail?: string
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{12,}/g,
  /[A-Za-z0-9_-]{16,}(?:[.][A-Za-z0-9_-]{6,}){2}/g, // JWT-like
  /api[_-]?key[\s]*[:=][\s]*['"]?[A-Za-z0-9_-]{10,}/gi,
  /password[\s]*[:=][\s]*['"]?[^\s'"]+/gi,
  /Authorization:\s*Bearer\s+\S+/gi,
  /AIza[0-9A-Za-z_-]{20,}/g,
]

export function sanitizeSecrets(text: string): string {
  if (!text) return ''
  let out = text
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]')
  }
  return out
}

let sequence = 0

export function createActivityLog(limit = 500) {
  const entries: ActivityEntry[] = []

  function add(partial: Omit<ActivityEntry, 'id' | 'time'>): ActivityEntry {
    const entry: ActivityEntry = {
      ...partial,
      id: `act-${Date.now()}-${sequence++}`,
      time: new Date().toISOString(),
      userCommand: sanitizeSecrets(partial.userCommand),
      intent: sanitizeSecrets(partial.intent),
      tool: sanitizeSecrets(partial.tool),
      action: sanitizeSecrets(partial.action),
      detail: partial.detail ? sanitizeSecrets(partial.detail) : undefined,
    }
    entries.unshift(entry)
    if (entries.length > limit) {
      entries.length = limit
    }
    return entry
  }

  function all(): ActivityEntry[] {
    return entries
  }

  function clear(): void {
    entries.length = 0
  }

  return { add, all, clear }
}

export type ActivityLog = ReturnType<typeof createActivityLog>

export const activityLog = createActivityLog()
