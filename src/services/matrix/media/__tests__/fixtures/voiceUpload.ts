import type { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { matrixVoiceService } from '@/services/matrix/media/MatrixVoiceService'

/**
 * 语音上传域夹具。
 *
 * 类型从真实返回签名推导：
 * - `uploadVoice` 返回 `VoiceMessageResult`（未导出，故用 `Awaited<ReturnType<...>>`）；
 * - `uploadEncryptedFile` 返回 `EncryptedUploadResult`（`contentUri / size / mimetype` + `encryptedFile`）。
 */

export type VoiceUploadResultFixture = Awaited<ReturnType<typeof matrixVoiceService.uploadVoice>>
export type EncryptedUploadResultFixture = Awaited<ReturnType<typeof matrixMediaService.uploadEncryptedFile>>

/**
 * 生成明文语音上传结果。
 *
 * 后端 `/voice/upload` 只返回 `content_uri / content / content_type / duration_ms / size`，
 * 上传阶段没有 `event_id`，故默认值不含 `eventId`。
 */
export function makeVoiceUploadResult(overrides: Partial<VoiceUploadResultFixture> = {}): VoiceUploadResultFixture {
  return {
    url: 'mxc://server.test/voice',
    filename: 'voice.webm',
    mxcUrl: 'mxc://server.test/voice',
    httpUrl: 'https://cdn.example/mxc%3A%2F%2Fserver.test%2Fvoice',
    ...overrides
  }
}

/** 生成加密 media 上传结果（密文以 `application/octet-stream` 落库）。 */
export function makeEncryptedUploadResult(
  overrides: Partial<EncryptedUploadResultFixture> = {}
): EncryptedUploadResultFixture {
  return {
    contentUri: 'mxc://server.test/encrypted-voice',
    size: 2,
    mimetype: 'application/octet-stream',
    encryptedFile: {
      url: 'mxc://server.test/encrypted-voice',
      key: { alg: 'A256CTR', key_ops: ['encrypt', 'decrypt'], kty: 'oct', k: 'test-key', ext: true },
      iv: 'iv-16-bytes-0123',
      hashes: { sha256: 'hash' },
      v: 'v2'
    },
    ...overrides
  }
}
