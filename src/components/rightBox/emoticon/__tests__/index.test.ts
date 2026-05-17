import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref, toRefs } from 'vue'
import Emoticon from '../index.vue'

const {
  showFeedbackMock,
  deleteEmojiMock,
  getEmojiListMock,
  loggerErrorMock,
  localUrlCacheClearMock,
  emojiUrlToLocalMapClearMock,
  hydrateEmojiLocalCacheMock,
  scheduleHydrateFavoritesMock,
  cleanupAllEmojiCachesMock,
  disconnectEmojiObserverMock,
  terminateWorkerMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  deleteEmojiMock: vi.fn(),
  getEmojiListMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  localUrlCacheClearMock: vi.fn(),
  emojiUrlToLocalMapClearMock: vi.fn(),
  hydrateEmojiLocalCacheMock: vi.fn(),
  scheduleHydrateFavoritesMock: vi.fn(),
  cleanupAllEmojiCachesMock: vi.fn(),
  disconnectEmojiObserverMock: vi.fn(),
  terminateWorkerMock: vi.fn()
}))

let historyStore: ReturnType<
  typeof reactive<{
    emoji: string[]
    lastEmojiTabIndex: number
    setEmoji: (value: string[]) => void
    setLastEmojiTabIndex: (value: number) => void
  }>
>

vi.mock('pinia', () => ({
  storeToRefs: <T extends object>(store: T) => toRefs(store)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/chat/emoji', () => ({
  useEmojiStore: () => ({
    emojiList: [],
    deleteEmoji: deleteEmojiMock,
    getEmojiList: getEmojiListMock
  })
}))

vi.mock('@/stores/domains/chat/history', () => ({
  useHistoryStore: () => historyStore
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({})
}))

vi.mock('@/utils/Emoji.ts', () => ({
  getAllTypeEmojis: () => ({
    expressionEmojis: { name: 'expression', value: ['😀'] },
    animalEmojis: { name: 'animal', value: [] },
    gestureEmojis: { name: 'gesture', value: [] }
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => false
}))

vi.mock('../useEmojiLocalCache', () => ({
  useEmojiLocalCache: () => ({
    getEmojiRenderUrl: vi.fn(() => ''),
    resolveCachedRenderUrl: vi.fn(() => ''),
    registerEmojiVisibilityTarget: vi.fn(),
    hydrateEmojiLocalCache: hydrateEmojiLocalCacheMock,
    scheduleHydrateFavorites: scheduleHydrateFavoritesMock,
    cleanupAllEmojiCaches: cleanupAllEmojiCachesMock,
    disconnectEmojiObserver: disconnectEmojiObserverMock,
    terminateWorker: terminateWorkerMock,
    emojiUrlToLocalMap: {
      clear: emojiUrlToLocalMapClearMock
    },
    localUrlCache: {
      clear: localUrlCacheClearMock
    }
  })
}))

vi.mock('../useEmojiPagination', () => ({
  useEmojiPagination: () => ({
    favoritesPage: ref(1),
    seriesPage: ref(1),
    favoritesPageSize: ref(20),
    packColumns: ref(6),
    seriesRowHeight: ref(72),
    seriesViewportHeight: ref('240px'),
    SERIES_PAGE_SIZE: 24,
    onPanelScroll: vi.fn(),
    onSeriesScroll: vi.fn(),
    resetFavoritesPage: vi.fn(),
    resetSeriesPage: vi.fn()
  })
}))

vi.mock('hula-emojis', () => ({
  default: {
    MihoyoBbs: {
      series: []
    }
  }
}))

const mountComponent = () =>
  mount(Emoticon, {
    props: {
      all: false
    },
    global: {
      stubs: {
        'n-scrollbar': {
          template: '<div><slot /></div>'
        },
        'n-flex': {
          template: '<div><slot /></div>'
        },
        'n-virtual-list': {
          template: '<div><slot :item="{ emojis: [] }" /></div>'
        },
        'n-popover': {
          template: '<div><slot name="trigger" /><slot /></div>'
        },
        'n-image': true,
        'n-button': true,
        'n-icon': true,
        transition: false
      }
    }
  })

describe('Emoticon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    historyStore = reactive({
      emoji: [],
      lastEmojiTabIndex: -1,
      setEmoji: vi.fn(),
      setLastEmojiTabIndex: vi.fn()
    })
    deleteEmojiMock.mockResolvedValue(undefined)
    getEmojiListMock.mockResolvedValue(undefined)
  })

  it('uses action feedback for favorite emoji delete success', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await (wrapper.vm as unknown as { deleteMyEmoji: (id: string) => Promise<void> }).deleteMyEmoji('emoji-1')
    await flushPromises()

    expect(deleteEmojiMock).toHaveBeenCalledWith('emoji-1')
    expect(showFeedbackMock).toHaveBeenCalledWith('emoticon.favorites.deleteSuccess', 'success')
    expect(localUrlCacheClearMock).toHaveBeenCalled()
    expect(emojiUrlToLocalMapClearMock).toHaveBeenCalled()
  })

  it('uses action feedback for favorite emoji delete failure', async () => {
    deleteEmojiMock.mockRejectedValueOnce(new Error('delete failed'))
    const wrapper = mountComponent()
    await flushPromises()

    await (wrapper.vm as unknown as { deleteMyEmoji: (id: string) => Promise<void> }).deleteMyEmoji('emoji-2')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('emoticon.favorites.deleteFail', 'error')
  })
})
