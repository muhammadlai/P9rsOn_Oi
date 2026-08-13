import { describe, it, expect } from 'vitest'
import { maskKey, evaluateAIStatus } from '../aiStatus'
import { redact } from '../../stores/activityStore'

describe('maskKey', () => {
  it('never reveals any part of the key', () => {
    const masked = maskKey('sk-super-secret-value-1234567890')
    expect(masked).toBe('••••••••••••••••')
    expect(masked).not.toContain('sk-')
    expect(masked).not.toContain('secret')
  })

  it('returns empty string for a missing key', () => {
    expect(maskKey('')).toBe('')
    expect(maskKey(undefined)).toBe('')
  })

  it('does not leak the key length', () => {
    expect(maskKey('short')).toBe(maskKey('a-very-long-api-key-value-here'))
  })
})

describe('evaluateAIStatus', () => {
  it('reports NOT_CONFIGURED with no key', () => {
    expect(evaluateAIStatus({ aiProvider: 'openai', hasApiKey: false })).toBe(
      'NOT_CONFIGURED'
    )
  })

  it('reports READY once a key is present', () => {
    expect(evaluateAIStatus({ aiProvider: 'openai', hasApiKey: true })).toBe(
      'READY'
    )
  })

  it('treats local providers as ready when a base URL is set', () => {
    expect(
      evaluateAIStatus({
        aiProvider: 'ollama',
        hasApiKey: false,
        baseUrl: 'http://localhost:11434/v1',
      })
    ).toBe('READY')
  })

  it('requires a base URL for local providers', () => {
    expect(evaluateAIStatus({ aiProvider: 'ollama', hasApiKey: false })).toBe(
      'NOT_CONFIGURED'
    )
  })
})

describe('activity log redaction', () => {
  it('redacts OpenAI-style keys', () => {
    const output = redact('using sk-abcdef1234567890abcdef to call')
    expect(output).not.toContain('sk-abcdef1234567890')
    expect(output).toContain('[redacted]')
  })

  it('redacts bearer tokens', () => {
    expect(redact('Authorization: Bearer abcdef123456789')).toContain(
      '[redacted]'
    )
  })

  it('redacts labelled secrets', () => {
    expect(redact('api_key=supersecretvalue')).toContain('[redacted]')
    expect(redact('password: hunter2000')).toContain('[redacted]')
  })

  it('leaves ordinary text intact', () => {
    expect(redact('Open YouTube')).toBe('Open YouTube')
  })
})
