import type { RealTimeVADOptions } from '@ricky0123/vad-web'

type VadCallbacks = Pick<RealTimeVADOptions, 'onSpeechStart' | 'onSpeechEnd'>

export function createVadOptions(
  assetPath: string,
  callbacks: VadCallbacks
): Partial<RealTimeVADOptions> {
  return {
    ...callbacks,
    baseAssetPath: assetPath,
    onnxWASMBasePath: assetPath,
    model: 'legacy',
    startOnLoad: false,
  }
}
