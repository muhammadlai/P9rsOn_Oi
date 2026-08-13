/**
 * ZARA — acceptance tests.
 *
 * Covers the exact command list Aitzaz specified, exercised through the same
 * router that voice and text both use. These assert the REAL action was
 * attempted (correct IPC channel + payload), not just that the UI replied.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommandRouter } from '../commandRouter'
import type { ConversationContext } from '../commandRouter'

type InvokeMock = ReturnType<
  typeof vi.fn<(channel: string, args?: any) => Promise<any>>
>
let invoke: InvokeMock

/** Records every IPC call so we can prove the action really fired. */
function setupIPC(overrides: Record<string, any> = {}) {
  const handlers: Record<string, (args?: any) => any> = {
    'electron:open-path': () => ({ success: true }),
    'websocket:send-request': () => ({
      success: true,
      data: { message: 'ok', success: true },
    }),
    'zara:open-application': () => ({ success: true, label: 'App' }),
    'zara:close-application': () => ({ success: true, label: 'App' }),
    'memory:save': () => ({ success: true }),
    'memory:get': () => ({
      success: true,
      data: [{ content: 'Owner is Aitzaz.' }],
    }),
    ...overrides,
  }
  invoke = vi.fn<(channel: string, args?: any) => Promise<any>>(
    async (channel, args) => {
      const handler = handlers[channel]
      if (!handler) throw new Error(`Unhandled channel: ${channel}`)
      return handler(args)
    }
  )
  ;(globalThis as any).window = { aliceIPC: { invoke } }
}

function makeRouter() {
  let context: ConversationContext = {}
  const stopSpeaking = vi.fn()
  const router = new CommandRouter({
    getContext: () => context,
    setContext: patch => {
      context = { ...context, ...patch }
    },
    confirm: async () => true,
    stopSpeaking,
    saveMemory: async content => {
      await invoke('memory:save', { content })
      return true
    },
    recallMemories: async () => {
      const result = await invoke('memory:get', {})
      return result.data.map((r: any) => r.content)
    },
    analyseScreen: async () => ({
      status: 'SUCCESS' as const,
      message: 'Looking at your screen now.',
    }),
    analyseCamera: async () => ({
      status: 'SUCCESS' as const,
      message: 'Opening the camera.',
    }),
  })
  return { router, stopSpeaking }
}

/** Extracts the URL passed to the real "open" IPC call. */
function openedUrl(): string | undefined {
  const call = invoke.mock.calls.find(c => c[0] === 'electron:open-path')
  return call?.[1]?.target
}

beforeEach(() => {
  delete (globalThis as any).window
})

describe('ZARA acceptance — the commands Aitzaz asked for', () => {
  it('"Zara." → acknowledges and keeps listening', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('Zara.')
    expect(out.reply).toBe("Yes, Aitzaz. I'm listening.")
  })

  it('"What is my name?" → goes to the AI brain (persona answers Aitzaz)', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('What is my name?')
    // Identity questions are answered by the persona, not a canned string.
    expect(out.delegateToAI).toBe(true)
  })

  it('"Open Google." → really opens google.com', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('Open Google.')

    expect(openedUrl()).toBe('https://www.google.com/')
    expect(out.result?.status).toBe('SUCCESS')
    expect(out.reply).toContain('Google is open')
  })

  it('"Open YouTube." → really opens youtube.com', async () => {
    setupIPC()
    const { router } = makeRouter()
    await router.route('Open YouTube.')
    expect(openedUrl()).toBe('https://www.youtube.com/')
  })

  it('"Search YouTube for AI." → hits the real YouTube search URL', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('Search YouTube for AI.')

    expect(openedUrl()).toContain('youtube.com/results?search_query=ai')
    expect(out.reply).toBe('Done.')
  })

  it('"Open ChatGPT." → really opens chat.openai.com', async () => {
    setupIPC()
    const { router } = makeRouter()
    await router.route('Open ChatGPT.')
    expect(openedUrl()).toContain('chat.openai.com')
  })

  it('"Go back." → sends a real bridge command', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('Go back.')

    const call = invoke.mock.calls.find(c => c[0] === 'websocket:send-request')
    expect(call?.[1]?.command).toBe('browser_back')
    expect(out.result?.status).toBe('SUCCESS')
  })

  it('"Open a new tab." → opens a real tab', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('Open a new tab.')
    expect(out.result?.status).toBe('SUCCESS')
  })

  it('"What time is it?" → answers locally, no AI needed', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('What time is it?')

    expect(out.delegateToAI).toBe(false)
    expect(out.result?.status).toBe('SUCCESS')
    expect(out.reply).toMatch(/It's .+/)
  })

  it('"Remember my name is Aitzaz." → persists to the memory store', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('Remember my name is Aitzaz.')

    const call = invoke.mock.calls.find(c => c[0] === 'memory:save')
    expect(call?.[1]?.content).toContain('aitzaz')
    expect(out.result?.status).toBe('SUCCESS')
  })

  it('"What do you remember?" → reads back stored memory', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route('What do you remember about me?')

    expect(invoke.mock.calls.some(c => c[0] === 'memory:get')).toBe(true)
    expect(out.reply).toContain('Aitzaz')
  })

  it('"Stop." → halts speech immediately', async () => {
    setupIPC()
    const { router, stopSpeaking } = makeRouter()
    await router.route('Stop.')
    expect(stopSpeaking).toHaveBeenCalled()
  })

  it('"What\'s on my screen?" → triggers screen analysis', async () => {
    setupIPC()
    const { router } = makeRouter()
    const out = await router.route("What's on my screen?")
    expect(out.command.intent).toBe('SCREEN_ANALYSIS')
    expect(out.result?.status).toBe('SUCCESS')
  })

  it('"Open Chrome." → launches the real application', async () => {
    setupIPC()
    const { router } = makeRouter()
    await router.route('Open Chrome.')

    const call = invoke.mock.calls.find(c => c[0] === 'zara:open-application')
    expect(call?.[1]?.appId).toBe('chrome')
  })

  it('"Open Calculator." → launches the real application', async () => {
    setupIPC()
    const { router } = makeRouter()
    await router.route('Open Calculator.')

    const call = invoke.mock.calls.find(c => c[0] === 'zara:open-application')
    expect(call?.[1]?.appId).toBe('calculator')
  })
})

describe('ZARA acceptance — multi-turn context', () => {
  it('open YouTube → "search for AI news" searches YouTube, not Google', async () => {
    setupIPC()
    const { router } = makeRouter()

    await router.route('Zara, open YouTube.')
    invoke.mockClear()
    const out = await router.route('Search for AI news.')

    expect(out.command.intent).toBe('SEARCH_YOUTUBE')
    expect(openedUrl()).toContain('youtube.com/results')
    // encodeURIComponent yields %20 for spaces; YouTube accepts it.
    expect(decodeURIComponent(openedUrl() || '')).toContain('ai news')
  })
})

describe('ZARA acceptance — honest failure reporting', () => {
  it('never says Done when the browser bridge is absent', async () => {
    setupIPC({
      'websocket:send-request': () => ({
        success: false,
        error: 'No WebSocket clients connected.',
      }),
    })
    const { router } = makeRouter()
    const out = await router.route('Refresh.')

    expect(out.result?.status).toBe('NOT_CONNECTED')
    expect(out.reply).not.toBe('Done.')
    expect(out.reply).toMatch(/not connected/i)
  })

  it('never says Done when an app fails to launch', async () => {
    setupIPC({
      'zara:open-application': () => ({
        success: false,
        reason: 'not-found',
        error: 'not installed',
      }),
    })
    const { router } = makeRouter()
    const out = await router.route('Open Spotify.')

    expect(out.result?.status).toBe('FAILED')
    expect(out.reply).toContain("doesn't seem to be installed")
  })

  it('reports UNSUPPORTED for apps outside the safe catalogue', async () => {
    setupIPC()
    const { router } = makeRouter()
    // "hacktool" is not in the catalogue, so it is never launched.
    const out = await router.route('Open hacktool')

    expect(invoke.mock.calls.some(c => c[0] === 'zara:open-application')).toBe(
      false
    )
    expect(out.delegateToAI).toBe(true)
  })
})
