/**
 * FT-120: L3 路径常量"无死常量"契约测试
 *
 * 验证 DM / MODERATION / AUTH / CRYPTO 模块中只保留被 L2 服务实际引用的常量，
 * 防止维护者被从未使用的路径常量误导。
 *
 * 当某常量不再被任何 L2 服务引用时，应将其从此处的 expected 集合中移除并从源文件删除；
 * 反之，新增常量时必须先在 L2 服务中接入，再将键名加入此处的 expected 集合。
 */
import { describe, expect, it } from 'vitest'

import { AUTH } from '../auth'
import { CRYPTO } from '../crypto'
import { MEDIA } from '../media'
import { MODERATION } from '../moderation'

/** 断言对象的键集合恰好等于 expectedKeys（顺序无关）。 */
function expectKeys(obj: object, expectedKeys: string[]): void {
  expect(Object.keys(obj).sort()).toEqual([...expectedKeys].sort())
}

describe('FT-120: 无死路径常量', () => {
  describe('MODERATION 模块仅保留被 L2 服务引用的常量', () => {
    // ReportService.reportRoom → MODERATION.REPORT_ROOM
    // ReportService.scoreReport → MODERATION.REPORT_EVENT_SCORE
    it('MODERATION 仅包含 REPORT_ROOM 与 REPORT_EVENT_SCORE', () => {
      expectKeys(MODERATION, ['REPORT_ROOM', 'REPORT_EVENT_SCORE'])
    })

    it('MODERATION 不再包含已移除的死常量', () => {
      expect(MODERATION).not.toHaveProperty('REPORT_EVENT')
      expect(MODERATION).not.toHaveProperty('REPORT_USER')
      expect(MODERATION).not.toHaveProperty('SCANNER_INFO')
    })
  })

  describe('AUTH 模块仅保留被 L2 服务引用的常量', () => {
    // MatrixQrLoginSdkService.reciprocateLogin → AUTH.QR_GENERATE_TOKEN
    // MSC4108_CREATE_RENDEZVOUS / MSC4108_RENDEZVOUS_SESSION 由 SDK 内部 rendezvous 传输使用，
    // 并被 QrLoginProtocol.contract.test.ts 契约校验，保留。
    it('AUTH 仅包含 QR_GENERATE_TOKEN 与 MSC4108 路径', () => {
      expectKeys(AUTH, ['QR_GENERATE_TOKEN', 'MSC4108_CREATE_RENDEZVOUS', 'MSC4108_RENDEZVOUS_SESSION'])
    })

    it('AUTH 不再包含已废弃的字符串常量', () => {
      for (const dead of [
        'LOGIN',
        'LOGOUT',
        'REFRESH',
        'REGISTER',
        'WHOAMI',
        'CAPABILITIES',
        'PASSWORD_CHANGE',
        'DEACTIVATE',
        'EMAIL_REQUEST_TOKEN'
      ]) {
        expect(AUTH).not.toHaveProperty(dead)
      }
    })
  })

  describe('CRYPTO 模块仅保留被 L2 服务引用的常量', () => {
    // MatrixCryptoService → ROOM_KEYS_RECOVER / VERIFY_START / QR_CODE_SHOW / QR_CODE_SCAN
    // MatrixDeviceService.getRoomKeyRequests → ROOM_KEYS_REQUEST
    it('CRYPTO 仅包含被 L2 服务引用的 5 个常量', () => {
      expectKeys(CRYPTO, ['ROOM_KEYS_RECOVER', 'VERIFY_START', 'QR_CODE_SHOW', 'QR_CODE_SCAN', 'ROOM_KEYS_REQUEST'])
    })

    it('CRYPTO 不再包含已移除的死常量', () => {
      for (const dead of [
        'KEYS_UPLOAD',
        'KEYS_QUERY',
        'KEYS_CLAIM',
        'KEYS_CHANGES',
        'DEVICE_SIGNING_UPLOAD',
        'SIGNATURES_UPLOAD',
        'SEND_TO_DEVICE',
        'ROOM_KEYS_VERSION',
        'ROOM_KEYS_KEYS',
        'ROOM_KEYS_RECOVERY_PROGRESS',
        'ROOM_KEYS_VERIFY',
        'ROOM_KEYS_BATCH_RECOVER',
        'KEY_ROTATION_CHECK',
        'KEY_ROTATION_ROTATE',
        'KEY_ROTATION_REVOKE',
        'KEY_ROTATION_CONFIG'
      ]) {
        expect(CRYPTO).not.toHaveProperty(dead)
      }
    })
  })

  describe('DM 模块已完全移除', () => {
    it('MATRIX_PATHS 不再包含 DM 键', async () => {
      const { MATRIX_PATHS } = await import('../index')
      expect(MATRIX_PATHS).not.toHaveProperty('DM')
    })
  })

  describe('MEDIA 模块仅保留被 L2 服务引用的常量', () => {
    // MatrixUrlPreviewService.getPreview → MEDIA.DOWNLOAD_PREFIX (mxc→http 拼接)
    // MatrixUrlPreviewService.getPreviewsFromEvent → MEDIA.MEDIA_PREFIX (排除媒体链接)
    // 上传/配额/配置/删除/具名上传/预览端点均已迁移到 client.getMediaManager()，不再需要路径常量。
    it('MEDIA 仅包含 DOWNLOAD_PREFIX 与 MEDIA_PREFIX', () => {
      expectKeys(MEDIA, ['DOWNLOAD_PREFIX', 'MEDIA_PREFIX'])
    })

    it('MEDIA 不再包含已迁移到 MediaManager 的死常量', () => {
      for (const dead of [
        'UPLOAD',
        'UPLOAD_WITH_ID',
        'CONFIG',
        'DELETE',
        'QUOTA_ALERTS',
        'QUOTA_CHECK',
        'QUOTA_STATS',
        'CLIENT_MEDIA_CONFIG',
        'PREVIEW_URL'
      ]) {
        expect(MEDIA).not.toHaveProperty(dead)
      }
    })
  })
})
