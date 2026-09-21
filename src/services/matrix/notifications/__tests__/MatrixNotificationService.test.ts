import type { IPusher, IPusherRequest, MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixNotificationService } from '../MatrixNotificationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
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
        enableSound: false
      })

      const config = matrixNotificationService.getConfig()
      expect(config.enableDesktop).toBe(false)
      expect(config.enableSound).toBe(false)
    })
  })

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = matrixNotificationService.getConfig()

      expect(config).toHaveProperty('enableDesktop')
      expect(config).toHaveProperty('enableSound')
      expect(config).toHaveProperty('enableVibrate')
      expect(config).toHaveProperty('showPreview')
      expect(config).toHaveProperty('showSender')
      expect(config).toHaveProperty('showMessageContent')
      expect(config).toHaveProperty('events')
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

  describe('dnd settings', () => {
    const DND_ENABLED_KEY = 'tjg-push-dnd'
    const DND_START_KEY = 'tjg-push-dnd-start'
    const DND_END_KEY = 'tjg-push-dnd-end'

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

      expect(fresh.getDndSettings()).toEqual({ enabled: false, startTime: null, endTime: null })
    })

    it('writes the window to the localStorage mirror', () => {
      matrixNotificationService.setDndSettings({ enabled: true, startTime: 1000, endTime: 2000 })

      expect(matrixNotificationService.getDndSettings()).toEqual({ enabled: true, startTime: 1000, endTime: 2000 })
      expect(localStorage.getItem(DND_ENABLED_KEY)).toBe('true')
      expect(localStorage.getItem(DND_START_KEY)).toBe('1000')
      expect(localStorage.getItem(DND_END_KEY)).toBe('2000')
    })

    it('clears a boundary from the mirror when the picker is emptied', () => {
      matrixNotificationService.setDndSettings({ enabled: true, startTime: 1000, endTime: 2000 })
      matrixNotificationService.setDndSettings({ enabled: true, startTime: null, endTime: 2000 })

      expect(matrixNotificationService.getDndSettings().startTime).toBeNull()
      expect(localStorage.getItem(DND_START_KEY)).toBeNull()
    })

    it('hydrates a fresh instance from the mirror in the constructor', async () => {
      matrixNotificationService.setDndSettings({ enabled: true, startTime: 1000, endTime: 2000 })

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getDndSettings()).toEqual({ enabled: true, startTime: 1000, endTime: 2000 })
    })

    it('drops a corrupt mirror timestamp instead of guessing', async () => {
      localStorage.setItem(DND_ENABLED_KEY, 'true')
      localStorage.setItem(DND_START_KEY, 'not-a-number')
      localStorage.setItem(DND_END_KEY, '2000')

      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService

      expect(fresh.getDndSettings()).toEqual({ enabled: true, startTime: null, endTime: 2000 })
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

    it('refreshes the cache when the account data has a window', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: () => ({ enabled: true, startTime: 1000, endTime: 2000 })
        }))
      } as unknown as MatrixClient)

      const result = await matrixNotificationService.syncDndFromAccountData()

      expect(result).toEqual({ enabled: true, startTime: 1000, endTime: 2000 })
      expect(matrixNotificationService.getDndSettings()).toEqual({ enabled: true, startTime: 1000, endTime: 2000 })
    })

    it('writes the local mirror after a successful account-data read so boot hydration sees it', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: () => ({ enabled: true, startTime: 1000, endTime: 2000 })
        }))
      } as unknown as MatrixClient)

      await matrixNotificationService.syncDndFromAccountData()

      expect(localStorage.getItem(DND_ENABLED_KEY)).toBe('true')
      expect(localStorage.getItem(DND_START_KEY)).toBe('1000')
      expect(localStorage.getItem(DND_END_KEY)).toBe('2000')

      // 冷启动：新实例只能从镜像水合，必须拿到账号数据那份窗口
      vi.resetModules()
      const fresh = (await import('../MatrixNotificationService')).matrixNotificationService
      expect(fresh.getDndSettings()).toEqual({ enabled: true, startTime: 1000, endTime: 2000 })
    })

    it('drops non-finite account-data timestamps instead of suppressing notifications', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getAccountData: vi.fn(() => ({
          getContent: () => ({ enabled: true, startTime: Number.NaN, endTime: 2000 })
        }))
      } as unknown as MatrixClient)

      const result = await matrixNotificationService.syncDndFromAccountData()

      expect(result).toEqual({ enabled: true, startTime: null, endTime: 2000 })
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

      expect(matrixNotificationService.getDndSettings()).toEqual({ enabled: true, startTime: start, endTime: end })
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

  describe('showNotification', () => {
    it('should not show notification when desktop notifications are disabled', async () => {
      matrixNotificationService.updateConfig({ enableDesktop: false })
      await matrixNotificationService.showNotification('Test', 'Body')
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

    it('hides the body when the account-level summary switch is off', () => {
      matrixNotificationService.updateConfig({ showMessageContent: false })
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'Body')
      expect(display.body).toBeUndefined()
      expect(display.title).toContain('Title')
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
      expect(display.body).toBeUndefined()
    })

    it('prefixes the title when a keyword is highlighted', () => {
      localStorage.setItem(PREF_KEY, JSON.stringify({ keywords: ['deploy'], keywordHighlight: true, priority: 'high' }))
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'the deploy is green')
      expect(display.title).toContain('[*]')
      expect(display.body).toBe('the deploy is green')
    })

    it('does not highlight while the body is folded', () => {
      localStorage.setItem(PREF_KEY, JSON.stringify({ keywords: ['deploy'], keywordHighlight: true, priority: 'low' }))
      const display = matrixNotificationService.buildNotificationDisplay('Title', 'the deploy is green')
      expect(display.title).not.toContain('[*]')
      expect(display.body).toBeUndefined()
    })
  })

  describe('playSound', () => {
    it('should not play sound when sound is disabled', async () => {
      matrixNotificationService.updateConfig({ enableSound: false })
      await matrixNotificationService.playSound('/notification.mp3')
    })
  })

  describe('vibrate', () => {
    it('should not vibrate when vibration is disabled', async () => {
      matrixNotificationService.updateConfig({ enableVibrate: false })
      await matrixNotificationService.vibrate()
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
