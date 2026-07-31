import { describe, expect, it } from 'vitest'
import path from 'node:path'
import {
  getAllowedHttpOrigins,
  getHttpOriginsRequiringApproval,
  resolvePathWithinRoot,
  validateHttpBridgeUrl,
} from '../../electron/main/securityBoundaries'

describe('security boundaries', () => {
  it('resolves nested files inside an allowed root', () => {
    const root = path.resolve('/tmp/alice-images')
    expect(resolvePathWithinRoot(root, 'nested/image.png')).toBe(
      path.join(root, 'nested/image.png')
    )
  })

  it.each(['../escape.png', 'nested/../../escape.png', '/tmp/escape.png', ''])(
    'rejects a path outside the allowed root: %s',
    requestedPath => {
      expect(() =>
        resolvePathWithinRoot('/tmp/alice-images', requestedPath)
      ).toThrow()
    }
  )

  it('allows configured provider and local service origins', () => {
    const origins = getAllowedHttpOrigins({
      ollamaBaseUrl: 'http://localhost:11434/v1',
      VITE_SEARXNG_URL: 'http://192.168.1.20:8080',
    })

    expect(
      validateHttpBridgeUrl('http://localhost:11434/v1/models', origins)
    ).toBe('http://localhost:11434/v1/models')
    expect(
      validateHttpBridgeUrl('http://192.168.1.20:8080/search', origins)
    ).toBe('http://192.168.1.20:8080/search')
  })

  it('allows every built-in cloud provider origin used by the HTTP bridge', () => {
    const origins = getAllowedHttpOrigins(null)
    for (const url of [
      'https://api.openai.com/v1/models',
      'https://openrouter.ai/api/v1/models',
      'https://api.minimax.io/v1/models',
    ]) {
      expect(validateHttpBridgeUrl(url, origins)).toBe(url)
    }
  })

  it('requires approval before settings grant access to a new origin', () => {
    expect(
      getHttpOriginsRequiringApproval(
        { ollamaBaseUrl: 'http://localhost:11434' },
        { ollamaBaseUrl: 'http://169.254.169.254' }
      )
    ).toEqual(['http://169.254.169.254'])
  })

  it('does not require approval for built-in or previously approved origins', () => {
    expect(
      getHttpOriginsRequiringApproval(null, {
        ollamaBaseUrl: 'http://localhost:11434/v1',
        zaiBaseUrl: 'https://api.z.ai/api/coding/paas/v4',
      })
    ).toEqual([])

    expect(
      getHttpOriginsRequiringApproval(
        { VITE_SEARXNG_URL: 'https://search.example.com/search' },
        { VITE_SEARXNG_URL: 'https://search.example.com/api/search' }
      )
    ).toEqual([])
  })

  it('rejects an invalid configured service URL during approval checks', () => {
    expect(() =>
      getHttpOriginsRequiringApproval(null, {
        ollamaBaseUrl: 'not a URL',
      })
    ).toThrow('HTTP bridge URL is invalid')
  })

  it.each([
    'http://169.254.169.254/latest/meta-data',
    'http://127.0.0.1:9999/private',
    'file:///etc/passwd',
    'https://user:password@example.com/private',
  ])('blocks an unconfigured or unsafe URL: %s', url => {
    const origins = getAllowedHttpOrigins({
      ollamaBaseUrl: 'http://localhost:11434',
    })
    expect(() => validateHttpBridgeUrl(url, origins)).toThrow()
  })
})
