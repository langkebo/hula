import type { IPusher, IPusherRequest, MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useI18nGlobal } from '@/services/i18n'
import matrixClientService from '../../MatrixClientService'
import { matrixNotificationService } from '../MatrixNotificationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { isPermissionGrantedMock } = vi.hoisted(() => ({
  isPermissionGrantedMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: isPermissionGrantedMock
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null as MatrixClient | null),
    waitForClientReady: vi.fn().mockResolvedValue(undefined)
  }
}))

const { matrixHttpClientRequestMock } = vi.hoisted(() => ({
  matrixHttpClientRequestMock: vi.fn()
}))

vi.mock('../../MatrixHttpClient', () => ({
  matrixHttpClient: {
    request: matrixHttpClientRequestMock
  }
}))

const mockPushManager = {
  getPushRules: vi.fn(),
  updatePushRule: vi.fn(),
  createPushRule: vi.fn(),
  deletePushRule: vi.fn(),
  setPusher: vi.fn(),
  getPushers: vi.fn()
}

const mockClient = {
  getPushManager: vi.fn().mockReturnValue(mockPushManager)
}

describe('MatrixNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 恢复 mock 实现（clearAllMocks 会清除 mockReturnValue）
    mockClient.getPushManager.mockReturnValue(mockPushManager)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initialize', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(matrixNotificationService.initialize()).rejects.toThrow('客户端未初始化')
    })

    it('should load push rules on initialization', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getPushManager: vi.fn().mockReturnValue({
          getPushRules: vi.fn().mockResolvedValue({
            global: { rule_id: 'global-rule' }
          })
        })
      } as unknown as MatrixClient)

      await matrixNotificationService.initialize()
      expect(true).toBe(true)
    })
  })

  describe('setPushRule', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const rule = {
        ruleId: 'test-rule',
        kind: 'override' as const,
        roomId: '!room:id',
        conditions: {},
        actions: ['notify'],
        enabled: true
      }

      await expect(matrixNotificationService.setPushRule(rule)).rejects.toThrow('客户端未初始化')
    })
  })

  describe('deletePushRule', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixNotificationService.deletePushRule('test-rule')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('setPusher', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixNotificationService.setPusher({ pushkey: 'test-push-key' } as IPusherRequest)).rejects.toThrow(
        '客户端未初始化'
      )
    })
  })

  describe('getPushRules', () => {
    it('should return rules from service', () => {
      const rules = matrixNotificationService.getPushRules()
      expect(Array.isArray(rules)).toBe(true)
    })

    it('should clear cached push rules when matrix client changes', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getPushManager: vi.fn().mockReturnValue({
          getPushRules: vi.fn().mockResolvedValue({
            global: {
              override: [{ rule_id: 'old-rule' }]
            }
          })
        })
      } as unknown as MatrixClient)

      await matrixNotificationService.initialize()
      expect(matrixNotificationService.getPushRules()).toHaveLength(1)

      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getPushManager: vi.fn().mockReturnValue({
          getPushRules: vi.fn().mockResolvedValue({
            global: {
              override: [{ rule_id: 'new-rule' }]
            }
          })
        })
      } as unknown as MatrixClient)

      expect(matrixNotificationService.getPushRules()).toEqual([])
    })
  })

  describe('getPushRule', () => {
    it('should return undefined for non-existent rule', () => {
      const rule = matrixNotificationService.getPushRule('non-existent')
      expect(rule).toBeUndefined()
    })

    it('should load push rules from new client after re-initialize', async () => {
      const oldClient = {
        getPushManager: vi.fn().mockReturnValue({
          getPushRules: vi.fn().mockResolvedValue({
            global: {
              override: [{ rule_id: 'old-rule' }]
            }
          })
        })
      }
      const newClient = {
        getPushManager: vi.fn().mockReturnValue({
          getPushRules: vi.fn().mockResolvedValue({
            global: {
              override: [{ rule_id: 'new-rule' }]
            }
          })
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient as unknown as MatrixClient)
      await matrixNotificationService.initialize()
      expect(matrixNotificationService.getPushRule('old-rule')?.rule_id).toBe('old-rule')

      vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as unknown as MatrixClient)
      await matrixNotificationService.initialize()
      expect(matrixNotificationService.getPushRule('new-rule')?.rule_id).toBe('new-rule')
      expect(matrixNotificationService.getPushRule('old-rule')).toBeUndefined()
    })
  })

  describe('updateConfig', () => {
    it('should update notification config', () => {
      matrixNotificationService.updateConfig({
        enableDesktop: false,
        showMessageContent: false
      })

      const config = matrixNotificationService.getConfig()
      expect(config.enableDesktop).toBe(false)
      expect(config.showMessageContent).toBe(false)
    })
  })

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = matrixNotificationService.getConfig()

      expect(config).toHaveProperty('enableDesktop')
      expect(config).toHaveProperty('showSender')
      expect(config).toHaveProperty('showMessageContent')
      expect(config).toHaveProperty('events')
    })

    it('no longer exposes the dead sound / vibrate / preview fields', () => {
      const config = matrixNotificationService.getConfig() as unknown as Record<string, unknown>

      expect(config).not.toHaveProperty('enableSound')
      expect(config).not.toHaveProperty('enableVibrate')
      expect(config).not.toHaveProperty('showPreview')
    })
  })

  describe('dead surface removal', () => {
    it('no longer exposes showNotification / playSound / vibrate', () => {
      const service = matrixNotificationService as unknown as Record<string, unknown>

      expect(service.showNotification).toBeUndefined()
      expect(service.playSound).toBeUndefined()
      expect(service.vibrate).toBeUndefined()
    })
  })

  describe('events config', () => {
    const CONFIG_STORAGE_KEY = 'tjg-notification-config'
    const LEGACY_THREAD_MENTION_KEY = 'tjg-thread-mention-notify'

    beforeEach(() => {
      localStorage.clear()
      matrixNotificationService.updateConfig({ events: {} })
    })

    it('exposes an empty events map by default (missing field means enabled)', () => {
      expect(matrixNotificationService.getConfig().events).toEqual({})
    })

    it('persists the thread_mention switch and restores it in a fresh instance', async () => {
      matrixNotificationService.setEventNotificationEnabled('thread_mention', false)

      expect(matrixNotificationService.getConfig().events.thread_mention).toBe(false)
      expect(JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) as string).events.thread_mention).toBe(false)

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().events.thread_mention).toBe(false)
    })

    it('drops a persisted events value that is not a boolean map', async () => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ events: 'nope' }))

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().events).toEqual({})
    })

    it('drops non-boolean event entries but keeps the boolean ones', async () => {
      localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({ events: { thread_mention: 'false', other_kind: true } })
      )

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().events).toEqual({ other_kind: true })
    })

    it('migrates the legacy thread mention key once, letting the new value win', async () => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ events: {} }))
      localStorage.setItem(LEGACY_THREAD_MENTION_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().events.thread_mention).toBe(false)
      expect(localStorage.getItem(LEGACY_THREAD_MENTION_KEY)).toBeNull()

      // 新值已存在时以新值为准：再次构造实例不会被旧 key 覆盖回去
      localStorage.setItem(LEGACY_THREAD_MENTION_KEY, 'true')
      fresh.setEventNotificationEnabled('thread_mention', false)
      vi.resetModules()
      const again = (await import('../MatrixNotificationService')).matrixNotificationService
      expect(again.getConfig().events.thread_mention).toBe(false)
    })

    it('migrates the legacy thread mention key even when no config was ever persisted', async () => {
      localStorage.removeItem(CONFIG_STORAGE_KEY)
      localStorage.setItem(LEGACY_THREAD_MENTION_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().events.thread_mention).toBe(false)
      expect(localStorage.getItem(LEGACY_THREAD_MENTION_KEY)).toBeNull()
    })
  })

  describe('legacy display config migration', () => {
    const CONFIG_STORAGE_KEY = 'tjg-notification-config'
    const LEGACY_DESKTOP_KEY = 'tjg-desktop-notification'
    const LEGACY_CONTENT_KEY = 'tjg-show-content'
    const LEGACY_SENDER_KEY = 'tjg-show-sender'

    beforeEach(() => {
      localStorage.clear()
    })

    it('adopts the base notification keys once when the new config never set them', async () => {
      localStorage.setItem(LEGACY_DESKTOP_KEY, 'false')
      localStorage.setItem(LEGACY_CONTENT_KEY, 'false')
      localStorage.setItem(LEGACY_SENDER_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      const config = fresh.getConfig()
      expect(config.enableDesktop).toBe(false)
      expect(config.showMessageContent).toBe(false)
      expect(config.showSender).toBe(false)
      expect(localStorage.getItem(LEGACY_DESKTOP_KEY)).toBeNull()
      expect(localStorage.getItem(LEGACY_CONTENT_KEY)).toBeNull()
      expect(localStorage.getItem(LEGACY_SENDER_KEY)).toBeNull()

      // 已持久化：再次冷启动仍然保持"关"，不依赖旧 key
      vi.resetModules()
      const again = (await import('../MatrixNotificationService')).matrixNotificationService
      expect(again.getConfig().enableDesktop).toBe(false)
      expect(again.getConfig().showMessageContent).toBe(false)
      expect(again.getConfig().showSender).toBe(false)
    })

    it('lets a newer persisted value win over the legacy key', async () => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ showMessageContent: true, showSender: true }))
      localStorage.setItem(LEGACY_CONTENT_KEY, 'false')
      localStorage.setItem(LEGACY_SENDER_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      const config = fresh.getConfig()
      expect(config.showMessageContent).toBe(true)
      expect(config.showSender).toBe(true)
      expect(localStorage.getItem(LEGACY_CONTENT_KEY)).toBeNull()
      expect(localStorage.getItem(LEGACY_SENDER_KEY)).toBeNull()
    })

    it('adopts legacy display keys when the persisted config is corrupt JSON', async () => {
      // 损坏时若回落「填满的默认配置」，默认值会被当成显式值：旧键不被采纳却被删除
      // （用户关过的 showSender 升级后被静默恢复为开）。回落 {} 才表示"什么都没显式写过"。
      localStorage.setItem(CONFIG_STORAGE_KEY, '{oops')
      localStorage.setItem(LEGACY_SENDER_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().showSender).toBe(false)
      expect(localStorage.getItem(LEGACY_SENDER_KEY)).toBeNull()
    })

    it('adopts legacy display keys when the persisted config fails validation', async () => {
      // 合法 JSON 但不是配置对象：isValidNotificationConfig 判否 → 同样必须回落 {}
      // （注意 `{ enableDesktop: 'yes' }` 不会触发校验失败：validateObject 在 requiredKeys
      //  为空时不执行单键校验器，该字段类型错误被静默接受，见下面单独的回归用例）
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(['not', 'a', 'config']))
      localStorage.setItem(LEGACY_CONTENT_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().showMessageContent).toBe(false)
      expect(localStorage.getItem(LEGACY_CONTENT_KEY)).toBeNull()
    })

    it('still adopts legacy display keys when a persisted field has the wrong type', async () => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ enableDesktop: 'yes' }))
      localStorage.setItem(LEGACY_CONTENT_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getConfig().showMessageContent).toBe(false)
      expect(localStorage.getItem(LEGACY_CONTENT_KEY)).toBeNull()
    })

    it('still lets an explicit persisted value win for its own field while other fields migrate', async () => {
      // 对照组：合法配置里显式写过的字段保持新值，未写过的字段仍采纳旧键
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ showSender: false }))
      localStorage.setItem(LEGACY_SENDER_KEY, 'true')
      localStorage.setItem(LEGACY_CONTENT_KEY, 'false')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      const config = fresh.getConfig()
      expect(config.showSender).toBe(false)
      expect(config.showMessageContent).toBe(false)
      expect(localStorage.getItem(LEGACY_SENDER_KEY)).toBeNull()
      expect(localStorage.getItem(LEGACY_CONTENT_KEY)).toBeNull()
    })
  })

  describe('dnd settings', () => {
    const DND_ENABLED_KEY = 'tjg-push-dnd'
    const DND_START_KEY = 'tjg-push-dnd-start'
    const DND_END_KEY = 'tjg-push-dnd-end'
    const DND_UPDATED_AT_KEY = 'tjg-push-dnd-updated-at'

    /** 起止同一时刻 = 全天勿扰（与纯函数语义一致），避免依赖真实时钟。 */
    const allDayWindow = () => {
      const now = Date.now()
      return { enabled: true, startTime: now, endTime: now }
    }

    // 账号数据同步是副作用（客户端未初始化时会打错误日志），这里只打桩同步，不碰缓存/镜像断言
    let dndSyncSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      localStorage.clear()
      dndSyncSpy = vi.spyOn(matrixNotificationService, 'syncDndToAccountData').mockResolvedValue(undefined)
      matrixNotificationService.setDndSettings({ enabled: false, startTime: null, endTime: null })
    })

    afterEach(() => {
      dndSyncSpy.mockRestore()
    })

    it('defaults to a disabled, boundary-less window when the mirror is empty', async () => {
      localStorage.clear()

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getDndSettings()).toEqual({ enabled: false, startTime: null, endTime: null, updatedAt: 0 })
    })

    it('writes the window and its write timestamp to the localStorage mirror', () => {
      matrixNotificationService.setDndSettings({ enabled: true, startTime: 1000, endTime: 2000 })

      const settings = matrixNotificationService.getDndSettings()
      expect(settings).toMatchObject({ enabled: true, startTime: 1000, endTime: 2000 })
      expect(settings.updatedAt).toBeGreaterThan(0)
      expect(localStorage.getItem(DND_ENABLED_KEY)).toBe('true')
      expect(localStorage.getItem(DND_START_KEY)).toBe('1000')
      expect(localStorage.getItem(DND_END_KEY)).toBe('2000')
      expect(localStorage.getItem(DND_UPDATED_AT_KEY)).toBe(String(settings.updatedAt))
    })

    it('clears a boundary from the mirror when the picker is emptied', () => {
      matrixNotificationService.setDndSettings({ enabled: true, startTime: 1000, endTime: 2000 })
      matrixNotificationService.setDndSettings({ enabled: true, startTime: null, endTime: 2000 })

      expect(matrixNotificationService.getDndSettings().startTime).toBeNull()
      expect(localStorage.getItem(DND_START_KEY)).toBeNull()
    })

    it('hydrates a fresh instance from the mirror in the constructor', async () => {
      matrixNotificationService.setDndSettings({ enabled: true, startTime: 1000, endTime: 2000 })
      const written = matrixNotificationService.getDndSettings()

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getDndSettings()).toEqual({
        enabled: true,
        startTime: 1000,
        endTime: 2000,
        updatedAt: written.updatedAt
      })
    })

    it('drops a corrupt mirror timestamp instead of guessing', async () => {
      localStorage.setItem(DND_ENABLED_KEY, 'true')
      localStorage.setItem(DND_START_KEY, 'not-a-number')
      localStorage.setItem(DND_END_KEY, '2000')
      localStorage.removeItem(DND_UPDATED_AT_KEY)

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getDndSettings()).toEqual({ enabled: true, startTime: null, endTime: 2000, updatedAt: 0 })
    })

    it('reports the injected clock inside an all-day window and outside a bounded one', () => {
      matrixNotificationService.setDndSettings(allDayWindow())
      expect(matrixNotificationService.isWithinDndWindow(new Date(2026, 5, 15, 3, 0))).toBe(true)

      matrixNotificationService.setDndSettings({
        enabled: true,
        startTime: new Date(2026, 5, 15, 22, 0).getTime(),
        endTime: new Date(2026, 5, 15, 23, 0).getTime()
      })
      expect(matrixNotificationService.isWithinDndWindow(new Date(2026, 5, 15, 3, 0))).toBe(false)
    })

    it('waits for the client before writing DND to account data instead of failing silently', async () => {
      // beforeEach 把同步方法打桩了，这里恢复真实实现来验证"先等就绪再写"
      dndSyncSpy.mockRestore()
      const setAccountData = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setAccountData } as unknown as MatrixClient)

      await matrixNotificationService.syncDndToAccountData({
        enabled: false,
        startTime: null,
        endTime: null,
        updatedAt: 123
      })

      expect(matrixClientService.waitForClientReady).toHaveBeenCalled()
      expect(setAccountData).toHaveBeenCalledWith('io.hula.dnd_settings', {
        enabled: false,
        startTime: null,
        endTime: null,
        updatedAt: 123
      })
    })

    it('does not leak an unhandled rejection when the DND account-data write fails', async () => {
      dndSyncSpy.mockRestore()
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        setAccountData: vi.fn().mockRejectedValue(new Error('offline'))
      } as unknown as MatrixClient)

      await expect(
        matrixNotificationService.syncDndToAccountData({ enabled: true, startTime: 1, endTime: 2, updatedAt: 1 })
      ).resolves.toBeUndefined()
    })

    it('refreshes the cache when the account data has a newer window', async () => {
      const serverUpdatedAt = Date.now() + 60_000
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: () => ({ enabled: true, startTime: 1000, endTime: 2000, updatedAt: serverUpdatedAt })
        }))
      } as unknown as MatrixClient)

      const result = await matrixNotificationService.syncDndFromAccountData()

      expect(result).toEqual({ enabled: true, startTime: 1000, endTime: 2000, updatedAt: serverUpdatedAt })
      expect(matrixNotificationService.getDndSettings()).toEqual({
        enabled: true,
        startTime: 1000,
        endTime: 2000,
        updatedAt: serverUpdatedAt
      })
    })

    it('writes the local mirror after a successful account-data read so boot hydration sees it', async () => {
      const serverUpdatedAt = Date.now() + 60_000
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: () => ({ enabled: true, startTime: 1000, endTime: 2000, updatedAt: serverUpdatedAt })
        }))
      } as unknown as MatrixClient)

      await matrixNotificationService.syncDndFromAccountData()

      expect(localStorage.getItem(DND_ENABLED_KEY)).toBe('true')
      expect(localStorage.getItem(DND_START_KEY)).toBe('1000')
      expect(localStorage.getItem(DND_END_KEY)).toBe('2000')
      expect(localStorage.getItem(DND_UPDATED_AT_KEY)).toBe(String(serverUpdatedAt))

      // 冷启动：新实例只能从镜像水合，必须拿到账号数据那份窗口
      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService
      expect(fresh.getDndSettings()).toEqual({
        enabled: true,
        startTime: 1000,
        endTime: 2000,
        updatedAt: serverUpdatedAt
      })
    })

    it('drops non-finite account-data timestamps instead of suppressing notifications', async () => {
      const serverUpdatedAt = Date.now() + 60_000
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: () => ({ enabled: true, startTime: Number.NaN, endTime: 2000, updatedAt: serverUpdatedAt })
        }))
      } as unknown as MatrixClient)

      const result = await matrixNotificationService.syncDndFromAccountData()

      expect(result).toEqual({ enabled: true, startTime: null, endTime: 2000, updatedAt: serverUpdatedAt })
      // 边界不完整 → 不抑制，而不是凭一个 NaN 走跨午夜分支误判
      expect(matrixNotificationService.isWithinDndWindow(new Date(2026, 5, 15, 3, 0))).toBe(false)
    })

    it('suppresses a plain mention through the decision gate while DND is active', () => {
      matrixNotificationService.setDndSettings(allDayWindow())

      expect(matrixNotificationService.shouldNotifyMessage({ isMention: true, isThread: false, body: 'hi' })).toBe(
        false
      )
    })

    it('leaves a plain mention untouched while DND is inactive', () => {
      matrixNotificationService.setDndSettings({ enabled: true, startTime: null, endTime: null })

      expect(matrixNotificationService.shouldNotifyMessage({ isMention: true, isThread: false, body: 'hi' })).toBe(true)
    })
  })

  /**
   * 冷启动 DND 拉取的冲突规则：`io.hula.dnd_settings` 新增 `updatedAt`，
   * 只有服务端更新时间更新时才覆盖本地镜像，否则本机刚改的勿扰设置会被旧值顶回去。
   */
  describe('dnd account data pull', () => {
    const DND_ENABLED_KEY = 'tjg-push-dnd'
    const DND_UPDATED_AT_KEY = 'tjg-push-dnd-updated-at'

    const stubAccountData = (content: Record<string, unknown> | null) => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => (content ? { getContent: () => content } : undefined))
      } as unknown as MatrixClient)
    }

    beforeEach(() => {
      localStorage.clear()
    })

    it('applies a legacy server window at boot when the local mirror has no DND yet', async () => {
      // 旧 payload 没有 updatedAt（视为 0）；本地从未配置过 → 服务端那份应当水合进来
      stubAccountData({ enabled: true, startTime: 1000, endTime: 2000 })

      const result = await matrixNotificationService.syncDndFromAccountData()

      expect(result).toEqual({ enabled: true, startTime: 1000, endTime: 2000, updatedAt: 0 })
      expect(matrixNotificationService.getDndSettings()).toEqual({
        enabled: true,
        startTime: 1000,
        endTime: 2000,
        updatedAt: 0
      })
      expect(localStorage.getItem(DND_ENABLED_KEY)).toBe('true')
    })

    it('lets the server overwrite the local mirror when its updatedAt is newer', async () => {
      matrixNotificationService.setDndSettings({ enabled: false, startTime: null, endTime: null })
      stubAccountData({ enabled: true, startTime: 5000, endTime: 6000, updatedAt: Date.now() + 60_000 })

      await matrixNotificationService.syncDndFromAccountData()

      expect(matrixNotificationService.getDndSettings()).toMatchObject({
        enabled: true,
        startTime: 5000,
        endTime: 6000
      })
    })

    it('keeps a newer local change when the server updatedAt is older', async () => {
      matrixNotificationService.setDndSettings({ enabled: false, startTime: null, endTime: null })
      localStorage.setItem(DND_UPDATED_AT_KEY, '9999999999999')
      stubAccountData({ enabled: true, startTime: 5000, endTime: 6000, updatedAt: 1000 })

      await matrixNotificationService.syncDndFromAccountData()

      expect(matrixNotificationService.getDndSettings().enabled).toBe(false)
      expect(localStorage.getItem(DND_ENABLED_KEY)).toBe('false')
    })

    it('does not let a legacy server payload without updatedAt overwrite a local edit', async () => {
      matrixNotificationService.setDndSettings({ enabled: false, startTime: null, endTime: null })
      stubAccountData({ enabled: true, startTime: 5000, endTime: 6000 })

      await matrixNotificationService.syncDndFromAccountData()

      expect(matrixNotificationService.getDndSettings().enabled).toBe(false)
    })

    it('stamps the account-data write with a monotonically fresh updatedAt', async () => {
      const setAccountData = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue({ setAccountData } as unknown as MatrixClient)

      matrixNotificationService.setDndSettings({ enabled: true, startTime: 1000, endTime: 2000 })
      await new Promise((resolve) => setTimeout(resolve, 0))

      const payload = setAccountData.mock.calls[0][1] as { updatedAt: number }
      expect(payload.updatedAt).toBeGreaterThan(0)
      expect(payload.updatedAt).toBe(matrixNotificationService.getDndSettings().updatedAt)
    })
  })

  /**
   * I3 回归：独立聊天窗口是各自独立的 realm，各持一份模块级内存快照。
   * 只读构造时的快照会导致「在设置窗口改了通知/DND，已打开的聊天窗口不生效」，
   * 且写回整份快照会覆盖别的窗口刚改的字段。
   */
  describe('cross-window freshness', () => {
    const CONFIG_STORAGE_KEY = 'tjg-notification-config'
    const DND_ENABLED_KEY = 'tjg-push-dnd'
    const DND_START_KEY = 'tjg-push-dnd-start'
    const DND_END_KEY = 'tjg-push-dnd-end'

    beforeEach(() => {
      localStorage.clear()
    })

    it('getConfig observes a config written by another window', () => {
      matrixNotificationService.updateConfig({ showSender: true, showMessageContent: true })
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ showSender: false, showMessageContent: false }))

      const config = matrixNotificationService.getConfig()

      expect(config.showSender).toBe(false)
      expect(config.showMessageContent).toBe(false)
    })

    it('a stale window cannot clobber a newer field when it changes another field', () => {
      // 另一个窗口刚把内容预览关掉
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ showMessageContent: false, showSender: true }))

      // 本窗口的旧快照只改 showSender，写回时不能把 showMessageContent 顶回旧值
      matrixNotificationService.updateConfig({ showSender: false })

      const persisted = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) as string)
      expect(persisted.showMessageContent).toBe(false)
      expect(persisted.showSender).toBe(false)
    })

    it('setEventNotificationEnabled merges into the freshest persisted events map', () => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ events: { other_kind: true } }))

      matrixNotificationService.setEventNotificationEnabled('thread_mention', false)

      const persisted = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) as string)
      expect(persisted.events).toEqual({ other_kind: true, thread_mention: false })
    })

    it('shouldNotifyMessage reads the freshest persisted event switches', () => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ events: { thread_mention: false } }))

      expect(matrixNotificationService.shouldNotifyMessage({ isMention: true, isThread: true, body: 'hi' })).toBe(false)
    })

    it('the DND gate observes a window written by another window', () => {
      const start = new Date(2026, 5, 15, 1, 0).getTime()
      const end = new Date(2026, 5, 15, 23, 0).getTime()
      localStorage.setItem(DND_ENABLED_KEY, 'true')
      localStorage.setItem(DND_START_KEY, String(start))
      localStorage.setItem(DND_END_KEY, String(end))

      expect(matrixNotificationService.getDndSettings()).toEqual({
        enabled: true,
        startTime: start,
        endTime: end,
        updatedAt: 0
      })
      expect(matrixNotificationService.isWithinDndWindow(new Date(2026, 5, 15, 3, 0))).toBe(true)
      expect(matrixNotificationService.shouldNotifyMessage({ isMention: true, isThread: false, body: 'hi' })).toBe(
        false
      )
    })
  })

  describe('requestNotificationPermission', () => {
    it('should return false when Notification API is not available', async () => {
      const originalNotification = window.Notification
      Object.defineProperty(window, 'Notification', {
        value: undefined,
        writable: true
      })

      const result = await matrixNotificationService.requestNotificationPermission()
      expect(result).toBe(false)

      Object.defineProperty(window, 'Notification', {
        value: originalNotification,
        writable: true
      })
    })
  })

  describe('canSendSystemNotification', () => {
    it('returns true when the OS reports the notification permission as granted', async () => {
      isPermissionGrantedMock.mockResolvedValue(true)

      await expect(matrixNotificationService.canSendSystemNotification()).resolves.toBe(true)
    })

    it('returns false when the notification permission is denied', async () => {
      isPermissionGrantedMock.mockResolvedValue(false)

      await expect(matrixNotificationService.canSendSystemNotification()).resolves.toBe(false)
    })

    it('returns false and logs when the permission check rejects (non-Tauri runtime)', async () => {
      isPermissionGrantedMock.mockRejectedValue(new Error('not a tauri runtime'))

      await expect(matrixNotificationService.canSendSystemNotification()).resolves.toBe(false)
    })
  })

  describe('buildNotificationDisplay', () => {
    const PREF_KEY = 'tjg-notification-display-preferences'

    beforeEach(() => {
      localStorage.removeItem(PREF_KEY)
      matrixNotificationService.updateConfig({ showMessageContent: true })
    })

    afterEach(() => {
      localStorage.removeItem(PREF_KEY)
    })

    it('shows the body when summary and priority allow it', () => {
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'Body')
      expect(display.title).toBe('Title')
      expect(display.body).toBe('Body')
    })

    it('keeps the title clean and puts the folded signal in the body', () => {
      matrixNotificationService.updateConfig({ showMessageContent: false })
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'Body')
      expect(display.title).toBe('Title')
      expect(display.body).toBe(useI18nGlobal().t('message.notify.folded'))
    })

    it('lets high priority override the account-level summary switch', () => {
      matrixNotificationService.updateConfig({ showMessageContent: false })
      localStorage.setItem(PREF_KEY, JSON.stringify({ priority: 'high' }))
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'Body')
      expect(display.body).toBe('Body')
    })

    it('lets low priority fold the body even when summary is on', () => {
      localStorage.setItem(PREF_KEY, JSON.stringify({ priority: 'low' }))
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'Body')
      expect(display.body).toBe(useI18nGlobal().t('message.notify.folded'))
    })

    it('reports a keyword hit in the body instead of prefixing the title', () => {
      localStorage.setItem(PREF_KEY, JSON.stringify({ keywords: ['deploy'], keywordHighlight: true, priority: 'high' }))
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'the deploy is green')
      expect(display.title).toBe('Title')
      expect(display.body).toBe(useI18nGlobal().t('message.notify.keyword_hit', { body: 'the deploy is green' }))
    })

    it('does not highlight while the body is folded', () => {
      localStorage.setItem(PREF_KEY, JSON.stringify({ keywords: ['deploy'], keywordHighlight: true, priority: 'low' }))
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'the deploy is green')
      expect(display.title).toBe('Title')
      expect(display.body).toBe(useI18nGlobal().t('message.notify.folded'))
    })

    it('never injects folded / highlighted markers into the title', () => {
      localStorage.setItem(PREF_KEY, JSON.stringify({ keywords: ['deploy'], keywordHighlight: true, priority: 'high' }))
      const highlighted = matrixNotificationService.buildNotificationDisplay('Title', 'the deploy is green')
      // eslint-disable-next-line no-useless-escape
      expect(highlighted.title).not.toMatch(/[[\]*•]/)

      localStorage.setItem(PREF_KEY, JSON.stringify({ priority: 'low' }))
      const folded = matrixNotificationService.buildNotificationDisplay('Title', 'the deploy is green')
      // eslint-disable-next-line no-useless-escape
      expect(folded.title).not.toMatch(/[[\]*•]/)
    })
  })

  describe('successful operations', () => {
    beforeEach(() => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    })

    it('should set push rule successfully', async () => {
      mockPushManager.updatePushRule.mockResolvedValueOnce(undefined)

      const rule = {
        ruleId: 'test-rule',
        kind: 'override' as const,
        roomId: '!room:id',
        conditions: {},
        actions: ['notify'],
        enabled: true
      }

      await matrixNotificationService.setPushRule(rule)
      expect(mockPushManager.updatePushRule).toHaveBeenCalledWith('global', 'override', 'test-rule', {
        actions: ['notify']
      })
    })

    it('should delete push rule successfully', async () => {
      mockPushManager.deletePushRule.mockResolvedValueOnce(undefined)

      await matrixNotificationService.deletePushRule('test-rule')
      expect(mockPushManager.deletePushRule).toHaveBeenCalledWith('global', 'override', 'test-rule')
    })

    it('should set pusher successfully', async () => {
      mockPushManager.setPusher.mockResolvedValueOnce(undefined)

      const pusher = {
        app_id: 'tjg',
        pushkey: 'device-token',
        kind: 'http'
      } as IPusherRequest

      await matrixNotificationService.setPusher(pusher)
      expect(mockPushManager.setPusher).toHaveBeenCalledWith(pusher)
    })
  })

  // FT-116: setPushRuleByScope 必须使用 SDK 的 client.addPushRule，
  // 不能绕过 SDK 直接走 matrixHttpClient（同文件 line 211 已用 client.setPushRule，
  // SDK 提供了 addPushRule，"SDK 无 addPushRule" 的注释是错误的）。
  describe('setPushRuleByScope (FT-116: use SDK addPushRule)', () => {
    beforeEach(() => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    })

    it('调用 SDK client.addPushRule 而非 matrixHttpClient.request', async () => {
      mockPushManager.createPushRule.mockResolvedValueOnce(undefined)

      const body = { actions: ['notify'], conditions: [] }
      await matrixNotificationService.setPushRuleByScope('global', 'override', 'rule-1', body)

      expect(mockPushManager.createPushRule).toHaveBeenCalledWith('global', 'override', 'rule-1', body)
      expect(matrixHttpClientRequestMock).not.toHaveBeenCalled()
    })

    it('SDK 调用失败时抛出异常', async () => {
      mockPushManager.createPushRule.mockRejectedValueOnce(new Error('boom'))

      await expect(
        matrixNotificationService.setPushRuleByScope('global', 'override', 'rule-1', { actions: [] })
      ).rejects.toThrow('boom')
      expect(matrixHttpClientRequestMock).not.toHaveBeenCalled()
    })
  })

  // FT-128: fetchPushers 应返回 IPusher[] 而非类型擦除的 Array<Record<string, unknown>>
  describe('fetchPushers (FT-128: return typed IPusher[])', () => {
    beforeEach(() => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    })

    it('返回 SDK getPushers 的 pushers 数组，保留 IPusher 类型', async () => {
      const pushers: IPusher[] = [
        { pushkey: 'k1', app_id: 'a1', kind: 'http' } as IPusher,
        { pushkey: 'k2', app_id: 'a2', kind: 'email' } as IPusher
      ]
      mockPushManager.getPushers.mockResolvedValueOnce(pushers)

      const result = await matrixNotificationService.fetchPushers()

      expect(result).toHaveLength(2)
      expect(result[0].pushkey).toBe('k1')
      expect(result[0].app_id).toBe('a1')
      expect(mockPushManager.getPushers).toHaveBeenCalled()
    })

    it('pushers 为空时返回空数组', async () => {
      mockPushManager.getPushers.mockResolvedValueOnce([])

      const result = await matrixNotificationService.fetchPushers()

      expect(result).toEqual([])
    })
  })

  // FT-129: setPusherByBody 应校验必填字段，不能无校验强转
  describe('setPusherByBody (FT-129: validate required fields)', () => {
    beforeEach(() => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    })

    it('缺少 pushkey 时抛出错误', async () => {
      await expect(matrixNotificationService.setPusherByBody({ app_id: 'a1', kind: 'http' })).rejects.toThrow()
      expect(mockPushManager.setPusher).not.toHaveBeenCalled()
    })

    it('缺少 app_id 时抛出错误', async () => {
      await expect(matrixNotificationService.setPusherByBody({ pushkey: 'k1', kind: 'http' })).rejects.toThrow()
      expect(mockPushManager.setPusher).not.toHaveBeenCalled()
    })

    it('缺少 kind 时抛出错误', async () => {
      await expect(matrixNotificationService.setPusherByBody({ pushkey: 'k1', app_id: 'a1' })).rejects.toThrow()
      expect(mockPushManager.setPusher).not.toHaveBeenCalled()
    })

    it('必填字段齐全时调用 SDK setPusher', async () => {
      mockPushManager.setPusher.mockResolvedValueOnce(undefined)

      await matrixNotificationService.setPusherByBody({ pushkey: 'k1', app_id: 'a1', kind: 'http' })

      expect(mockPushManager.setPusher).toHaveBeenCalledWith(
        expect.objectContaining({ pushkey: 'k1', app_id: 'a1', kind: 'http' })
      )
    })
  })
})
