import type { MatrixClient } from '@/services/matrix/sdk'

type VoiceManagerInstance = ReturnType<NonNullable<MatrixClient['getVoiceManager']>>

/**
 * SDK `VoiceManager.getVoiceConfig()` 的响应（契约 DTO `VoiceConfigResponse`）。
 *
 * 类型来源：SDK manager 方法签名
 * `MatrixClient['getVoiceManager']().getVoiceConfig()`。
 */
export type VoiceConfigResponse = Awaited<ReturnType<VoiceManagerInstance['getVoiceConfig']>>

export function makeVoiceConfigResponse(overrides: Partial<VoiceConfigResponse> = {}): VoiceConfigResponse {
  return {
    enabled: true,
    max_duration: 300,
    allowed_formats: ['audio/webm', 'audio/ogg', 'audio/mp4'],
    supported_formats: ['audio/webm', 'audio/ogg', 'audio/mp4'],
    max_size_bytes: 10 * 1024 * 1024,
    max_duration_ms: 300_000,
    content_type: 'audio/webm',
    voice_extension: 'webm',
    auto_transcribe: false,
    server_side_processing: {
      convert: false,
      optimize: false,
      transcription: false
    },
    ...overrides
  }
}
