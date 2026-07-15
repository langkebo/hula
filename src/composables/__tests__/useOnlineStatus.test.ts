import { describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { useOnlineStatus } from '@/composables/common/useOnlineStatus'
import { OnlineEnum } from '@/enums'

const userStoreMock = reactive({
  userInfo: {
    uid: '@test:server',
    userStateId: '',
    activeStatus: OnlineEnum.ONLINE
  }
})

const groupStoreMock = {
  getUserInfo: vi.fn(() => ({
    uid: '@test:server',
    userStateId: '',
    activeStatus: OnlineEnum.ONLINE
  }))
}

const contactStoreMock = {
  getContactByUserId: vi.fn(() => null)
}

const userStatusStoreMock = reactive({
  stateList: [],
  currentState: null
})

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => ({
      currentState: computed(() => store.currentState)
    })
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStoreMock
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => userStatusStoreMock
}))

describe('useOnlineStatus', () => {
  it('当前用户优先使用 userStore 的在线状态，避免 groupStore 未同步时显示离线', () => {
    const { isOnline, statusTitle, activeStatus } = useOnlineStatus()

    expect(activeStatus.value).toBe(OnlineEnum.ONLINE)
    expect(isOnline.value).toBe(true)
    expect(statusTitle.value).toBe('home.profile_card.status.online')
  })
})
