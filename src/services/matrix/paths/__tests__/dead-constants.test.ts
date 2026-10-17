/**
 * FT-120: L3 路径常量"无死常量"契约测试
 *
 * 验证 AUTH / VOICE / ROOM 模块中只保留被 L2 服务实际引用的常量，
 * 防止维护者被从未使用的路径常量误导。
 *
 * 当某常量不再被任何 L2 服务引用时，应将其从此处的 expected 集合中移除并从源文件删除；
 * 反之，新增常量时必须先在 L2 服务中接入，再将键名加入此处的 expected 集合。
 *
 * C-2（§7/§8）：MODERATION / MEDIA / ADMIN / WIDGET / USER / BURN / GUEST /
 * ACCOUNT_DATA / RELATIONS / RENDEZVOUS 等命名空间因生产零引用，其源模块与
 * 本用例中的对应断言已一并删除，见 __tests__/index.test.ts 的删除结果锁定用例。
 */
import { describe, expect, it, vi } from 'vitest'

// 「扫描全仓」类守卫：用例会遍历 src/** 检查常量引用。实测单文件 16s ⇒ 默认 5s 必然超时
// （断言从未真正执行）。显式放宽到 120s。见审计报告 §12.2 / §13。
vi.setConfig({ testTimeout: 120_000 })

import { AUTH } from '../auth'
import { ROOM } from '../room'
import { VOICE } from '../voice'

/** 断言对象的键集合恰好等于 expectedKeys（顺序无关）。 */
function expectKeys(obj: object, expectedKeys: string[]): void {
  expect(Object.keys(obj).sort()).toEqual([...expectedKeys].sort())
}

describe('FT-120: 无死路径常量', () => {
  describe('AUTH 模块仅保留被 L2 服务引用的常量', () => {
    // MatrixQrLoginSdkService.reciprocateLogin → AUTH.QR_GENERATE_TOKEN
    // 2026-10-17 Batch C-0：MSC4108_CREATE_RENDEZVOUS / MSC4108_RENDEZVOUS_SESSION 已删除。
    // 原注释称其「由 SDK 内部 rendezvous 传输使用」不成立 —— Tjg 的路径常量不可能被 SDK
    // 内部消费；QR 登录的 rendezvous 由 SDK `MSC4108RendezvousSession` 自行实现。
    it('AUTH 仅包含 QR_GENERATE_TOKEN', () => {
      expectKeys(AUTH, ['QR_GENERATE_TOKEN'])
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

  describe('DM 模块已完全移除', () => {
    it('MATRIX_PATHS 不再包含 DM 键', async () => {
      const { MATRIX_PATHS } = await import('../index')
      expect(MATRIX_PATHS).not.toHaveProperty('DM')
    })
  })

  describe('VOICE 模块仅保留被 L2 服务引用的常量', () => {
    // MatrixVoiceService.uploadVoice → VOICE.UPLOAD (authedRequestWithPath)
    // MatrixVoiceService.getVoiceConfig → VOICE.CONFIG (endpointCapabilityService.check)
    // MatrixVoiceService.deleteVoice/getVoiceContent → VOICE.CONTENT (capability + path)
    // MatrixVoiceService.getRoomVoiceList → VOICE.ROOM_LIST (authedRequestWithPath)
    // MatrixVoiceService.getUserVoiceList → VOICE.USER_LIST (authedRequestWithPath)
    // MatrixVoiceService.convertVoice → VOICE.CONVERT (endpointCapabilityService.check)
    // MatrixVoiceService.optimizeVoice → VOICE.OPTIMIZE (endpointCapabilityService.check)
    // MatrixVoiceService.transcribeVoiceViaApi → VOICE.TRANSCRIPTION (capability)
    // 2026-10-17 Batch C-0：VOICE.RTC_TRANSPORTS 已删除 —— getRtcTransports 实测已改调
    // SDK `client.getVoiceManager().getRtcTransports()`（旧注释称其使用路径常量，已过期）。
    // VOICE.STATS / ROOM_STATS / USER_STATS 已迁移到 VoiceManager，不再需要路径常量。
    it('VOICE 仅包含被 L2 服务引用的 8 个常量', () => {
      expectKeys(VOICE, [
        'CONFIG',
        'UPLOAD',
        'ROOM_LIST',
        'USER_LIST',
        'CONTENT',
        'CONVERT',
        'OPTIMIZE',
        'TRANSCRIPTION'
      ])
    })

    it('VOICE 不再包含已迁移到 VoiceManager 的死常量', () => {
      for (const dead of ['STATS', 'ROOM_STATS', 'USER_STATS']) {
        expect(VOICE).not.toHaveProperty(dead)
      }
    })
  })

  describe('ROOM 模块不再包含已迁移到 InviteBlocklistManager 的死常量', () => {
    // RoomOperations.getInviteBlocklist/setInviteBlocklist/getInviteAllowlist/
    // setInviteAllowlist 已迁移到 client.getInviteBlocklistManager()，不再需要路径常量。
    it('ROOM 不再包含 INVITE_BLOCKLIST / INVITE_ALLOWLIST', () => {
      expect(ROOM).not.toHaveProperty('INVITE_BLOCKLIST')
      expect(ROOM).not.toHaveProperty('INVITE_ALLOWLIST')
    })
  })
})
