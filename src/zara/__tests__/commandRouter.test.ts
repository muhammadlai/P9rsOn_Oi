import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommandRouter, speakResult } from '../commandRouter'
import type { ConversationContext } from '../commandRouter'

/** Builds a router with an in-memory context and a stubbed IPC bridge. */
function makeRouter(overrides: Partial<Record<string, any>> = {}) {
  let context: ConversationContext = {}
  const onIntent = vi.fn()
  const onResult = vi.fn()

  const router = new CommandRouter({
    getContext: () => context,
    setContext: patch => {
      context = { ...context, ...patch }
    },
    onIntent,
    onResult,
    ...overrides,
  })

  return { router, onIntent, onResult, getContext: () => context }
}

/** Simulates the Electron IPC bridge. */
function stubIPC(handlers: Record<string, (args?: any) => any>) {
  ;(globalThis as any).window = {
    aliceIPC: {
      invoke: vi.fn(async (channel: string, args?: any) => {
        const handler = handlers[channel]
        if (!handler) throw new Error(`Unhandled channel ${channel}`)
        return handler(args)
      }),
    },
  }
}

beforeEach(() => {
  delete (globalThis as any).window
})

describe('CommandRouter — deterministic actions', () => {
  it('opens a website and reports real success', async () => {
    stubIPC({ 'electron:open-path': () => ({ success: true }) })
    const { router, onResult } = makeRouter()

    const outcome = await router.route('Zara, open Google')

    expect(outcome.command.intent).toBe('OPEN_WEBSITE')
    expect(outcome.delegateToAI).toBe(false)
    expect(outcome.result?.status).toBe('SUCCESS')
    expect(outcome.reply).toContain('Google is open')
    expect(onResult).toHaveBeenCalledWith('OPEN_WEBSITE', expect.anything())
  })

  it('never claims success when opening actually failed', async () => {
    stubIPC({
      'electron:open-path': () => ({ success: false, message: 'nope' }),
    })
    const { router } = makeRouter()

    const outcome = await router.route('open Google')

    expect(outcome.result?.status).toBe('FAILED')
    expect(outcome.reply).not.toMatch(/done|open\b.*\bis open/i)
    expect(outcome.reply).toContain("couldn't open")
  })

  it('reports NOT_CONNECTED for tab control without the extension', async () => {
    stubIPC({
      'websocket:send-request': () => ({
        success: false,
        error: 'No WebSocket clients connected.',
      }),
    })
    const { router } = makeRouter()

    const outcome = await router.route('go back')

    expect(outcome.command.intent).toBe('BROWSER_BACK')
    expect(outcome.result?.status).toBe('NOT_CONNECTED')
    expect(outcome.reply).toMatch(/not connected/i)
  })

  it('answers the time without any AI call', async () => {
    const { router } = makeRouter()
    const outcome = await router.route('what time is it')

    expect(outcome.command.intent).toBe('GET_TIME')
    expect(outcome.delegateToAI).toBe(false)
    expect(outcome.result?.status).toBe('SUCCESS')
  })

  it('acknowledges a bare wake word and keeps the turn open', async () => {
    const { router } = makeRouter()
    const outcome = await router.route('Zara')

    expect(outcome.delegateToAI).toBe(false)
    expect(outcome.reply).toBe("Yes, Aitzaz. I'm listening.")
  })
})

describe('CommandRouter — conversation context', () => {
  it('inherits YouTube context for a follow-up search', async () => {
    stubIPC({ 'electron:open-path': () => ({ success: true }) })
    const { router } = makeRouter()

    await router.route('open YouTube')
    const follow = await router.route('search for AI news')

    expect(follow.command.intent).toBe('SEARCH_YOUTUBE')
    expect(follow.result?.status).toBe('SUCCESS')
  })

  it('still uses Google when the user says Google explicitly', async () => {
    stubIPC({ 'electron:open-path': () => ({ success: true }) })
    const { router } = makeRouter()

    await router.route('open YouTube')
    const follow = await router.route('search Google for AI news')

    expect(follow.command.intent).toBe('SEARCH_WEB')
  })
})

describe('CommandRouter — confirmation', () => {
  it('aborts a destructive action when not confirmed', async () => {
    const confirm = vi.fn(async () => false)
    const { router } = makeRouter({ confirm })

    const outcome = await router.route('delete all my files')

    expect(confirm).toHaveBeenCalledWith(
      'This action requires confirmation. Continue?'
    )
    expect(outcome.reply).toContain('Cancelled')
  })
})

describe('CommandRouter — delegation', () => {
  it('delegates open-ended conversation to the AI brain', async () => {
    const { router } = makeRouter()
    const outcome = await router.route('tell me a joke about robots')

    expect(outcome.delegateToAI).toBe(true)
    expect(outcome.result).toBeUndefined()
  })
})

describe('CommandRouter — memory', () => {
  it('saves a memory through the hook', async () => {
    const saveMemory = vi.fn(async () => true)
    const { router } = makeRouter({ saveMemory })

    const outcome = await router.route('remember my name is Aitzaz')

    expect(saveMemory).toHaveBeenCalledWith('my name is aitzaz')
    expect(outcome.result?.status).toBe('SUCCESS')
  })

  it('recalls memories through the hook', async () => {
    const recallMemories = vi.fn(async () => ['Your name is Aitzaz.'])
    const { router } = makeRouter({ recallMemories })

    const outcome = await router.route('what do you remember about me')

    expect(recallMemories).toHaveBeenCalled()
    expect(outcome.reply).toContain('Aitzaz')
  })
})

describe('speakResult', () => {
  it('says Done only on success', () => {
    expect(
      speakResult('SEARCH_WEB', { status: 'SUCCESS', message: 'Searched.' })
    ).toBe('Done.')
  })

  it('surfaces the real problem on failure', () => {
    const reply = speakResult('SEARCH_WEB', {
      status: 'NOT_CONNECTED',
      message: 'Browser control is not connected.',
    })
    expect(reply).toBe('Browser control is not connected.')
  })
})

describe('CommandRouter — interruption', () => {
  it('stops speech immediately on "stop"', async () => {
    const stopSpeaking = vi.fn()
    const { router } = makeRouter({ stopSpeaking })

    const outcome = await router.route('stop')

    expect(stopSpeaking).toHaveBeenCalled()
    expect(outcome.result?.status).toBe('SUCCESS')
  })
})
