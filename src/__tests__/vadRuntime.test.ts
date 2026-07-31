import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  vadRuntimeAssetNames,
  vadStaticCopyTargets,
} from '../../build/vadAssets'
import { createVadOptions } from '../composables/vadRuntime'

describe('VAD runtime packaging', () => {
  it('ships every configured local runtime asset', () => {
    for (const target of vadStaticCopyTargets) {
      expect(fs.existsSync(path.resolve(target.src)), target.src).toBe(true)
    }

    expect(vadRuntimeAssetNames).toEqual(
      expect.arrayContaining([
        'vad.worklet.bundle.min.js',
        'silero_vad_legacy.onnx',
        'ort-wasm-simd-threaded.mjs',
        'ort-wasm-simd-threaded.wasm',
      ])
    )
  })
})

describe('VAD initialization options', () => {
  it('uses local assets and leaves startup under application control', () => {
    const onSpeechStart = vi.fn()
    const onSpeechEnd = vi.fn()

    const options = createVadOptions('file:///app/dist/', {
      onSpeechStart,
      onSpeechEnd,
    })

    expect(options).toMatchObject({
      baseAssetPath: 'file:///app/dist/',
      onnxWASMBasePath: 'file:///app/dist/',
      model: 'legacy',
      startOnLoad: false,
      onSpeechStart,
      onSpeechEnd,
    })
  })
})
