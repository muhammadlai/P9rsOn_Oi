import { describe, it, expect } from 'vitest'
import {
  parseIntent,
  matchWakeWord,
  resolveSite,
  resolveApp,
} from '../intentParser'

describe('matchWakeWord', () => {
  it('detects a bare wake word', () => {
    const result = matchWakeWord('Zara')
    expect(result.detected).toBe(true)
    expect(result.bareWake).toBe(true)
    expect(result.command).toBe('')
  })

  it('detects "Hey Zara" with a trailing command', () => {
    const result = matchWakeWord('Hey Zara, open Google')
    expect(result.detected).toBe(true)
    expect(result.bareWake).toBe(false)
    expect(result.command).toBe('open Google')
  })

  it('strips punctuation after the wake word', () => {
    expect(matchWakeWord('Zara, listen').command).toBe('listen')
    expect(matchWakeWord('Zara: what time is it').command).toBe(
      'what time is it'
    )
  })

  it('does not trigger on words merely starting with zara', () => {
    const result = matchWakeWord('Zaragoza is a city')
    expect(result.detected).toBe(false)
    expect(result.command).toBe('Zaragoza is a city')
  })

  it('returns the original text when no wake word is present', () => {
    const result = matchWakeWord('open youtube')
    expect(result.detected).toBe(false)
    expect(result.command).toBe('open youtube')
  })
})

describe('resolveSite', () => {
  it('resolves known site names', () => {
    expect(resolveSite('google')).toBe('https://www.google.com')
    expect(resolveSite('YouTube')).toBe('https://www.youtube.com')
    expect(resolveSite('gmail')).toBe('https://mail.google.com')
    expect(resolveSite('chatgpt')).toBe('https://chat.openai.com')
  })

  it('resolves bare domains', () => {
    expect(resolveSite('example.com')).toBe('https://example.com')
  })

  it('returns null for unknown words', () => {
    expect(resolveSite('some random thing')).toBeNull()
  })
})

describe('resolveApp', () => {
  it('resolves app aliases to canonical ids', () => {
    expect(resolveApp('VS Code')).toBe('vscode')
    expect(resolveApp('google chrome')).toBe('chrome')
    expect(resolveApp('calculator')).toBe('calculator')
  })
})

describe('parseIntent', () => {
  it('routes website opening', () => {
    const cmd = parseIntent('open Google')
    expect(cmd.intent).toBe('OPEN_WEBSITE')
    expect(cmd.slots.url).toBe('https://www.google.com')
    expect(cmd.deterministic).toBe(true)
  })

  it('routes YouTube as a website, not an app', () => {
    expect(parseIntent('open YouTube').intent).toBe('OPEN_WEBSITE')
  })

  it('routes application launching', () => {
    const cmd = parseIntent('open VS Code')
    expect(cmd.intent).toBe('OPEN_APPLICATION')
    expect(cmd.slots.app).toBe('vscode')
  })

  it('routes web search', () => {
    const cmd = parseIntent('search for AI news')
    expect(cmd.intent).toBe('SEARCH_WEB')
    expect(cmd.slots.query).toBe('ai news')
  })

  it('routes YouTube search', () => {
    const cmd = parseIntent('search YouTube for AI videos')
    expect(cmd.intent).toBe('SEARCH_YOUTUBE')
    expect(cmd.slots.query).toBe('ai videos')
  })

  it('routes a combined open-and-search command', () => {
    const cmd = parseIntent('open YouTube and search for AI videos')
    expect(cmd.intent).toBe('SEARCH_YOUTUBE')
    expect(cmd.slots.query).toBe('ai videos')
  })

  it('routes browser navigation', () => {
    expect(parseIntent('go back').intent).toBe('BROWSER_BACK')
    expect(parseIntent('go forward').intent).toBe('BROWSER_FORWARD')
    expect(parseIntent('refresh the page').intent).toBe('REFRESH_PAGE')
    expect(parseIntent('open a new tab').intent).toBe('NEW_TAB')
    expect(parseIntent('close this tab').intent).toBe('CLOSE_TAB')
  })

  it('routes time and date', () => {
    expect(parseIntent('what time is it').intent).toBe('GET_TIME')
    expect(parseIntent("what's the date").intent).toBe('GET_DATE')
  })

  it('routes memory commands', () => {
    const save = parseIntent('remember my name is Aitzaz')
    expect(save.intent).toBe('SAVE_MEMORY')
    expect(save.slots.content).toBe('my name is aitzaz')
    expect(parseIntent('what do you remember about me').intent).toBe(
      'RECALL_MEMORY'
    )
  })

  it('routes screen and camera analysis', () => {
    expect(parseIntent("what's on my screen").intent).toBe('SCREEN_ANALYSIS')
    expect(parseIntent('what do you see').intent).toBe('CAMERA_ANALYSIS')
  })

  it('routes stop as an interruption', () => {
    expect(parseIntent('stop').intent).toBe('STOP_SPEAKING')
  })

  it('flags destructive commands for confirmation', () => {
    expect(parseIntent('delete my project files').requiresConfirmation).toBe(
      true
    )
    expect(parseIntent('open Google').requiresConfirmation).toBe(false)
  })

  it('falls back to conversation for chit-chat', () => {
    const cmd = parseIntent('how are you feeling today')
    expect(cmd.intent).toBe('GENERAL_CONVERSATION')
    expect(cmd.deterministic).toBe(false)
  })

  it('understands Roman Urdu open commands', () => {
    const cmd = parseIntent('chrome kholo')
    expect(cmd.intent).toBe('OPEN_APPLICATION')
    expect(cmd.slots.app).toBe('chrome')
  })
})
