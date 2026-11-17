import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mocks = vi.hoisted(() => ({
  showFeedback: vi.fn(),
  getUserId: vi.fn(),
  getUserVoiceList: vi.fn(),
  getRoomVoiceList: vi.fn(),
  getVoiceStats: vi.fn(),
  getUserVoiceStats: vi.fn(),
  getVoiceConfig: vi.fn(),
  getVoiceContent: vi.fn(),
  deleteVoice: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getUserId: mocks.getUserId }
}))

vi.mock('@/services/matrix/media/MatrixVoiceService', () => ({
  matrixVoiceService: {
    getUserVoiceList: mocks.getUserVoiceList,
    getRoomVoiceList: mocks.getRoomVoiceList,
    getVoiceStats: mocks.getVoiceStats,
    getUserVoiceStats: mocks.getUserVoiceStats,
    getVoiceConfig: mocks.getVoiceConfig,
    getVoiceContent: mocks.getVoiceContent,
    deleteVoice: mocks.deleteVoice
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

import VoiceMessageSettings from '../VoiceMessageSettings.vue'

const MESSAGE = {
  media_id: 'm1',
  user_id: '@u:hs',
  room_id: '!r:hs',
  content_uri: 'mxc://hs/a',
  content_type: 'audio/ogg',
  duration_ms: 5000,
  size_bytes: 2048,
  created_ts: 1700000000000
}

const naiveStubs = {
  Input: {
    props: ['value', 'placeholder', 'clearable'],
    emits: ['update:value'],
    template: '<input class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />'
  },
  Button: {
    props: ['size', 'type', 'loading'],
    emits: ['click'],
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>'
  },
  Spin: { props: ['show'], template: '<div class="n-spin"><slot /></div>' },
  Empty: { props: ['description'], template: '<div class="n-empty" />' },
  Popconfirm: { template: '<div class="n-popconfirm"><slot name="trigger" /><slot /></div>' }
}

async function mountSection() {
  const wrapper = mount(VoiceMessageSettings, { global: { stubs: naiveStubs } })
  await flushPromises()
  return wrapper
}

describe('VoiceMessageSettings（VEN-01 统计/配置 UI）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserId.mockReturnValue('@u:hs')
    mocks.getUserVoiceList.mockResolvedValue({ messages: [MESSAGE], next_batch: null })
    mocks.getRoomVoiceList.mockResolvedValue({ messages: [MESSAGE], next_batch: null })
    mocks.getVoiceStats.mockResolvedValue({ totalDuration: 300, totalMessages: 5, averageDuration: 60 })
    mocks.getUserVoiceStats.mockResolvedValue({ totalDuration: 90, totalMessages: 3 })
    mocks.getVoiceConfig.mockResolvedValue({
      maxDuration: 120,
      allowedFormats: ['ogg', 'mp3'],
      autoTranscribe: true
    })
  })

  it('挂载时并行加载本人列表/全局统计/本人统计并渲染', async () => {
    const wrapper = await mountSection()

    expect(mocks.getUserVoiceList).toHaveBeenCalledWith('@u:hs')
    expect(mocks.getVoiceStats).toHaveBeenCalledTimes(1)
    expect(mocks.getUserVoiceStats).toHaveBeenCalledWith('@u:hs')

    const userStats = wrapper.get('[data-testid="voice-user-stats"]')
    expect(userStats.text()).toContain('3')
    expect(userStats.text()).toContain('1:30')

    const listText = wrapper.text()
    expect(listText).toContain('m1')
    expect(listText).toContain('0:05')
    expect(listText).toContain('2 KB')
  })

  it('渲染能力配置：最大时长/格式/自动转写开关', async () => {
    const wrapper = await mountSection()

    const config = wrapper.get('[data-testid="voice-config"]')
    expect(config.text()).toContain('2:00')
    expect(config.text()).toContain('ogg, mp3')
    expect(config.text()).toContain('setting.voice_video.voice_messages.config_enabled')
  })

  it('配置接口失败时降级显示 config_unavailable', async () => {
    mocks.getVoiceConfig.mockRejectedValue(new Error('404'))

    const wrapper = await mountSection()

    const config = wrapper.get('[data-testid="voice-config"]')
    expect(config.text()).toContain('setting.voice_video.voice_messages.config_unavailable')
    expect(config.text()).not.toContain('setting.voice_video.voice_messages.config_enabled')
  })

  it('未登录（userId 为空）时跳过列表与统计请求，但配置仍加载', async () => {
    mocks.getUserId.mockReturnValue('')

    const wrapper = await mountSection()

    expect(mocks.getUserVoiceList).not.toHaveBeenCalled()
    expect(mocks.getRoomVoiceList).not.toHaveBeenCalled()
    expect(mocks.getVoiceStats).not.toHaveBeenCalled()
    expect(mocks.getUserVoiceStats).not.toHaveBeenCalled()
    expect(mocks.getVoiceConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('填写房间过滤后刷新走房间列表接口（trim 后传参）', async () => {
    const wrapper = await mountSection()
    mocks.getRoomVoiceList.mockClear()

    await wrapper.get('.n-input').setValue('  !room:hs  ')
    await wrapper.get('[data-testid="voice-messages-refresh"]').trigger('click')
    await flushPromises()

    expect(mocks.getRoomVoiceList).toHaveBeenCalledWith('!room:hs')
    expect(mocks.getUserVoiceList).toHaveBeenCalledTimes(1)
  })

  it('列表加载失败时提示 load_failed', async () => {
    mocks.getUserVoiceList.mockRejectedValue(new Error('500'))

    await mountSection()

    expect(mocks.showFeedback).toHaveBeenCalledWith('setting.voice_video.voice_messages.load_failed', 'error')
  })
})
