import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetPushRules, mockSetPushRuleActions, mockShowFeedback } = vi.hoisted(() => ({
  mockGetPushRules: vi.fn(),
  mockSetPushRuleActions: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/notifications/MatrixPushService', () => ({
  matrixPushService: {
    getPushRules: mockGetPushRules,
    setPushRuleActions: mockSetPushRuleActions
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import type { IPushRules } from '@/types/matrix-services'
import { buildActions, inferActionType, usePushRuleEditor } from '../usePushRuleEditor'

/** 构造测试用 IPushRules */
function buildRules(): IPushRules {
  return {
    global: {
      override: [
        {
          rule_id: '.m.rule.master',
          default: true,
          enabled: false,
          actions: ['dont_notify']
        },
        {
          rule_id: '.m.rule.invite_for_me',
          default: true,
          enabled: true,
          actions: ['notify', { set_tweak: { tweak: 'highlight' as any, value: false } }]
        }
      ],
      content: [
        {
          rule_id: '.m.rule.contains_user_name',
          default: true,
          enabled: true,
          actions: ['notify', { set_tweak: { tweak: 'sound' as any, value: 'default' } }],
          pattern: 'alice'
        }
      ],
      room: [
        {
          rule_id: '!roomA:server',
          default: false,
          enabled: true,
          actions: ['dont_notify']
        }
      ],
      sender: [],
      underride: [
        {
          rule_id: '.m.rule.call',
          default: true,
          enabled: true,
          actions: ['notify', { set_tweak: { tweak: 'sound' as any, value: 'ringtone' } }]
        }
      ]
    }
  }
}

describe('usePushRuleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load', () => {
    it('加载推送规则成功时填充 rules 并清除 loading', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())

      const editor = usePushRuleEditor()
      await editor.load()

      expect(mockGetPushRules).toHaveBeenCalledTimes(1)
      expect(editor.rules.value).not.toBeNull()
      expect(editor.loading.value).toBe(false)
      expect(editor.errorMessage.value).toBeNull()
    })

    it('加载失败时设置 errorMessage 并显示错误反馈', async () => {
      mockGetPushRules.mockRejectedValueOnce(new Error('network'))

      const editor = usePushRuleEditor()
      await editor.load()

      expect(editor.rules.value).toBeNull()
      expect(editor.loading.value).toBe(false)
      expect(editor.errorMessage.value).toBe('setting.push.editor.load_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('setting.push.editor.load_failed', 'error')
    })
  })

  describe('computed', () => {
    it('flatRules 将各类别规则扁平化并保留 kind 信息', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())

      const editor = usePushRuleEditor()
      await editor.load()

      // override 2 + content 1 + room 1 + underride 1 = 5
      expect(editor.flatRules.value).toHaveLength(5)
      expect(editor.flatRules.value[0]).toEqual({
        kind: 'override',
        rule: expect.objectContaining({ rule_id: '.m.rule.master' })
      })
      expect(editor.flatRules.value[3]).toEqual({
        kind: 'room',
        rule: expect.objectContaining({ rule_id: '!roomA:server' })
      })
    })

    it('hasRules 在有规则时为 true', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())

      const editor = usePushRuleEditor()
      await editor.load()

      expect(editor.hasRules.value).toBe(true)
    })

    it('hasRules 在无规则时为 false', async () => {
      mockGetPushRules.mockResolvedValueOnce({ global: {} })

      const editor = usePushRuleEditor()
      await editor.load()

      expect(editor.hasRules.value).toBe(false)
      expect(editor.flatRules.value).toEqual([])
    })

    it('groupedRules 按 kind 分组返回规则', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())

      const editor = usePushRuleEditor()
      await editor.load()

      expect(editor.groupedRules.value.override).toHaveLength(2)
      expect(editor.groupedRules.value.content).toHaveLength(1)
      expect(editor.groupedRules.value.room).toHaveLength(1)
      expect(editor.groupedRules.value.sender).toHaveLength(0)
      expect(editor.groupedRules.value.underride).toHaveLength(1)
    })
  })

  describe('updateRule', () => {
    it('更新成功时调用 setPushRuleActions 并同步本地状态', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())
      mockSetPushRuleActions.mockResolvedValueOnce(undefined)

      const editor = usePushRuleEditor()
      await editor.load()

      const result = await editor.updateRule('.m.rule.master', ['notify'])

      expect(result).toBe(true)
      expect(mockSetPushRuleActions).toHaveBeenCalledWith('global', 'override', '.m.rule.master', ['notify'])
      expect(editor.updating.value).toBe(false)
      // 本地状态已同步
      const master = editor.flatRules.value.find((item) => item.rule.rule_id === '.m.rule.master')
      expect(master?.rule.actions).toEqual(['notify'])
      expect(mockShowFeedback).toHaveBeenCalledWith('setting.push.editor.update_success', 'success')
    })

    it('更新失败时显示错误反馈并返回 false', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())
      mockSetPushRuleActions.mockRejectedValueOnce(new Error('forbidden'))

      const editor = usePushRuleEditor()
      await editor.load()

      const result = await editor.updateRule('.m.rule.master', ['notify'])

      expect(result).toBe(false)
      expect(editor.updating.value).toBe(false)
      expect(editor.errorMessage.value).toBe('setting.push.editor.update_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('setting.push.editor.update_failed', 'error')
    })

    it('规则不存在时返回 false 并提示', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())

      const editor = usePushRuleEditor()
      await editor.load()

      const result = await editor.updateRule('.nonexistent.rule', ['notify'])

      expect(result).toBe(false)
      expect(mockSetPushRuleActions).not.toHaveBeenCalled()
      expect(mockShowFeedback).toHaveBeenCalledWith('setting.push.editor.rule_not_found', 'error')
    })

    it('updating 在操作期间为 true,结束后恢复', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())
      let resolveUpdate: () => void = () => {}
      mockSetPushRuleActions.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveUpdate = resolve)))

      const editor = usePushRuleEditor()
      await editor.load()

      const promise = editor.updateRule('.m.rule.master', ['notify'])
      expect(editor.updating.value).toBe(true)

      resolveUpdate()
      await promise

      expect(editor.updating.value).toBe(false)
    })
  })

  describe('updateRuleByActionType', () => {
    it('根据动作类型构造 actions 并调用 updateRule', async () => {
      mockGetPushRules.mockResolvedValueOnce(buildRules())
      mockSetPushRuleActions.mockResolvedValueOnce(undefined)

      const editor = usePushRuleEditor()
      await editor.load()

      const result = await editor.updateRuleByActionType('.m.rule.master', 'coalesce')

      expect(result).toBe(true)
      expect(mockSetPushRuleActions).toHaveBeenCalledWith('global', 'override', '.m.rule.master', [
        'notify',
        'coalesce'
      ])
    })
  })

  describe('inferActionType / buildActions', () => {
    it('inferActionType 识别 dont_notify', () => {
      expect(inferActionType(['dont_notify'])).toBe('dont_notify')
    })

    it('inferActionType 识别 notify', () => {
      expect(inferActionType(['notify', { set_tweak: { tweak: 'sound' as any, value: 'default' } }])).toBe('notify')
    })

    it('inferActionType 识别 coalesce', () => {
      expect(inferActionType(['notify', 'coalesce'])).toBe('coalesce')
    })

    it('inferActionType 在无已知动作时默认 dont_notify', () => {
      expect(inferActionType([{ set_tweak: { tweak: 'sound' as any, value: 'default' } }])).toBe('dont_notify')
    })

    it('buildActions 为 dont_notify 返回单元素数组', () => {
      expect(buildActions('dont_notify')).toEqual(['dont_notify'])
    })

    it('buildActions 为 notify 返回单元素数组', () => {
      expect(buildActions('notify')).toEqual(['notify'])
    })

    it('buildActions 为 coalesce 返回 notify + coalesce', () => {
      expect(buildActions('coalesce')).toEqual(['notify', 'coalesce'])
    })
  })
})
