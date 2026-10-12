import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

/**
 * 本文件用**局部** i18n mock（覆盖 tests/setup.ts 的全局 mock）：
 * 全局 mock 只是 `translations[key] || key`，看不出 `{count}` 这类**参数**是否被传对。
 * 这里把参数一并渲染出来，用于断言"未验证设备台数确实作为参数传给了文案"。
 */
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key
      const rendered = Object.entries(params)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',')
      return `${key}|${rendered}`
    },
    locale: { value: 'zh-CN' }
  }),
  createI18n: vi.fn()
}))

const { isRoomEncryptedMock, setRoomStrictMock, refreshMock, harness } = vi.hoisted(() => ({
  isRoomEncryptedMock: vi.fn(async () => true),
  setRoomStrictMock: vi.fn(),
  refreshMock: vi.fn(),
  /** 真实 ref 句柄由 mock 工厂填充（`vi.hoisted` 里不能 import vue，故只放容器） */
  harness: {} as Record<string, unknown>
}))

vi.mock('@/composables/encryption/useEncryption', () => ({
  useEncryption: () => ({ isRoomEncrypted: isRoomEncryptedMock })
}))

vi.mock('@/composables/encryption/useRoomStrictness', async () => {
  const { computed, ref } = await import('vue')
  // ⚠️ 必须用**真实 ref**做数据源：若 computed 读的是普通对象属性，
  // 它没有任何响应式依赖 ⇒ 首次求值后被永久缓存（本轮实测踩到，测试假绿/假红都由此产生）。
  const unverifiedCount = ref<number | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const strictActiveSource = ref(false)
  const roomOverrideSource = ref<boolean | null>(null)
  Object.assign(harness, { unverifiedCount, status, strictActiveSource, roomOverrideSource })
  return {
    useRoomStrictness: () => ({
      unverifiedCount,
      status,
      strictActive: computed(() => strictActiveSource.value),
      roomOverride: computed(() => roomOverrideSource.value),
      globalStrict: computed(() => false),
      refresh: refreshMock,
      setRoomStrict: setRoomStrictMock,
      setGlobalStrict: vi.fn()
    })
  }
})

import E2EEBanner from '@/components/chat/E2EEBanner.vue'

interface Harness {
  unverifiedCount: { value: number | null }
  status: { value: 'idle' | 'loading' | 'ready' | 'failed' }
  strictActiveSource: { value: boolean }
  roomOverrideSource: { value: boolean | null }
}
const h = harness as unknown as Harness

/** 组件的 onMounted 里 await isRoomEncrypted(...) 后才会置 isEncrypted=true。 */
async function mountBanner(roomId = '!r:e') {
  const wrapper = mount(E2EEBanner, { props: { roomId } })
  await vi.waitFor(() => expect(isRoomEncryptedMock).toHaveBeenCalled())
  await nextTick()
  await nextTick()
  return wrapper
}

describe('E2EEBanner（R-1 未验证设备提示）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isRoomEncryptedMock.mockResolvedValue(true)
    h.unverifiedCount.value = null
    h.status.value = 'idle'
    h.strictActiveSource.value = false
    h.roomOverrideSource.value = null
    localStorage.clear()
  })

  it('未验证设备 > 0 时显示提示，且台数作为参数传入文案', async () => {
    h.unverifiedCount.value = 2
    h.status.value = 'ready'
    const wrapper = await mountBanner()
    const notice = wrapper.get('[data-testid="e2ee-unverified-notice"]')
    expect(notice.text()).toContain('count=2')
    expect(wrapper.find('[data-testid="e2ee-notice-enable-strict"]').exists()).toBe(true)
  })

  it('未验证设备为 0 时不显示提示（回落到普通"已加密"横幅）', async () => {
    h.unverifiedCount.value = 0
    h.status.value = 'ready'
    const wrapper = await mountBanner()
    expect(wrapper.find('[data-testid="e2ee-unverified-notice"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('e2ee.banner.title')
  })

  it('查询失败时给出"无法确认"提示并提供重试，且不得声称设备都已验证', async () => {
    h.unverifiedCount.value = null
    h.status.value = 'failed'
    const wrapper = await mountBanner()
    const notice = wrapper.get('[data-testid="e2ee-unverified-notice"]')
    expect(notice.text()).toContain('e2ee.unverified.query_failed_title')
    expect(wrapper.find('[data-testid="e2ee-notice-retry"]').exists()).toBe(true)
    expect(notice.text()).not.toContain('count=0')
  })

  it('点击"仅向已验证设备发送"会调用 setRoomStrict(true)', async () => {
    h.unverifiedCount.value = 1
    h.status.value = 'ready'
    const wrapper = await mountBanner()
    await wrapper.get('[data-testid="e2ee-notice-enable-strict"]').trigger('click')
    expect(setRoomStrictMock).toHaveBeenCalledWith(true)
  })

  it('已启用房间级严格模式时显示"恢复默认"，点击传 false', async () => {
    h.unverifiedCount.value = 1
    h.status.value = 'ready'
    h.strictActiveSource.value = true
    h.roomOverrideSource.value = true
    const wrapper = await mountBanner()
    expect(wrapper.find('[data-testid="e2ee-notice-enable-strict"]').exists()).toBe(false)
    await wrapper.get('[data-testid="e2ee-notice-revert-strict"]').trigger('click')
    expect(setRoomStrictMock).toHaveBeenCalledWith(false)
  })

  it('全局严格模式（无房间覆盖）不显示"恢复默认"（避免误导为可在此关闭全局）', async () => {
    h.unverifiedCount.value = 1
    h.status.value = 'ready'
    h.strictActiveSource.value = true
    h.roomOverrideSource.value = null
    const wrapper = await mountBanner()
    expect(wrapper.find('[data-testid="e2ee-notice-revert-strict"]').exists()).toBe(false)
  })

  it('关闭提示只作用于本次会话（不写盘），换房间后重置', async () => {
    h.unverifiedCount.value = 1
    h.status.value = 'ready'
    const wrapper = await mountBanner()
    await wrapper.get('[data-testid="e2ee-notice-dismiss"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="e2ee-unverified-notice"]').exists()).toBe(false)

    await wrapper.setProps({ roomId: '!other:e' })
    await nextTick()
    await nextTick()
    expect(wrapper.find('[data-testid="e2ee-unverified-notice"]').exists()).toBe(true)
    // 安全信号不应被一次点击永久静音
    expect(localStorage.length).toBe(0)
  })
})
