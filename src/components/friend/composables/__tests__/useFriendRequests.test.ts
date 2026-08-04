import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { FriendRequestItem, MatrixContact } from '@/stores/domains/chat/contacts'

const { showFeedbackMock, announceMock, acceptFriendRequestMock, rejectFriendRequestMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  announceMock: vi.fn(),
  acceptFriendRequestMock: vi.fn().mockResolvedValue(true),
  rejectFriendRequestMock: vi.fn().mockResolvedValue(true)
}))

// Reactive ref for incomingRequestsCount, so watch() can track changes.
// Defined at module scope so the mock factory can close over it.
const incomingRequestsCountRef = ref(0)

const contactStoreMock = {
  contactsList: [] as MatrixContact[],
  isLoading: false,
  requestFriendsList: [] as FriendRequestItem[],
  get incomingRequestsCount() {
    return incomingRequestsCountRef.value
  },
  set incomingRequestsCount(value: number) {
    incomingRequestsCountRef.value = value
  },
  lastFriendError: null as { message: string } | null,
  acceptFriendRequest: acceptFriendRequestMock,
  rejectFriendRequest: rejectFriendRequestMock
}

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock,
    messages: { value: [] },
    clearAnnouncements: vi.fn()
  })
}))

import { useFriendRequests } from '../useFriendRequests'

const makeRequest = (overrides: Partial<FriendRequestItem> = {}): FriendRequestItem => ({
  userId: '@bob:example.com',
  displayName: 'Bob',
  avatarUrl: 'mxc://example.com/bob',
  message: 'Hi',
  timestamp: Date.now(),
  direction: 'incoming',
  applyId: 'bob',
  ...overrides
})

describe('useFriendRequests', () => {
  let scope: ReturnType<typeof effectScope> | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    contactStoreMock.requestFriendsList = []
    incomingRequestsCountRef.value = 0
    acceptFriendRequestMock.mockResolvedValue(true)
    rejectFriendRequestMock.mockResolvedValue(true)
    scope = effectScope()
  })

  afterEach(() => {
    scope?.stop()
    scope = null
  })

  // Helper: run useFriendRequests inside an effect scope so watches are cleaned up per test
  const useFriendRequestsScoped = () => scope!.run(() => useFriendRequests())!

  describe('previewIncomingRequests', () => {
    it('filters incoming requests and slices to 3', () => {
      contactStoreMock.requestFriendsList = [
        makeRequest({ userId: '@a:ex.com', applyId: 'a' }),
        makeRequest({ userId: '@b:ex.com', applyId: 'b' }),
        makeRequest({ userId: '@c:ex.com', applyId: 'c' }),
        makeRequest({ userId: '@d:ex.com', applyId: 'd' }),
        makeRequest({ userId: '@e:ex.com', direction: 'outgoing', applyId: 'e' })
      ]
      const { previewIncomingRequests } = useFriendRequestsScoped()

      expect(previewIncomingRequests.value).toHaveLength(3)
      expect(previewIncomingRequests.value.every((r) => r.direction === 'incoming')).toBe(true)
    })

    it('returns empty when no incoming requests', () => {
      contactStoreMock.requestFriendsList = [makeRequest({ userId: '@a:ex.com', direction: 'outgoing', applyId: 'a' })]
      const { previewIncomingRequests } = useFriendRequestsScoped()
      expect(previewIncomingRequests.value).toHaveLength(0)
    })
  })

  describe('handleQuickAccept', () => {
    it('calls acceptFriendRequest and shows success feedback', async () => {
      const { handleQuickAccept, processingRequest } = useFriendRequestsScoped()
      const request = makeRequest({ userId: '@bob:ex.com' })

      await handleQuickAccept(request)

      expect(acceptFriendRequestMock).toHaveBeenCalledWith('@bob:ex.com')
      expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.success.accept', 'success')
      expect(processingRequest.value).toBeNull()
    })

    it('sets processingRequest during processing', async () => {
      let resolveAccept!: (value: boolean) => void
      acceptFriendRequestMock.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveAccept = resolve
        })
      )
      const { handleQuickAccept, processingRequest } = useFriendRequestsScoped()
      const request = makeRequest({ userId: '@bob:ex.com' })

      const promise = handleQuickAccept(request)
      await nextTick()
      expect(processingRequest.value).toBe('@bob:ex.com')

      resolveAccept(true)
      await promise
      expect(processingRequest.value).toBeNull()
    })

    it('shows error feedback on failure', async () => {
      acceptFriendRequestMock.mockRejectedValue(new Error('network'))
      const { handleQuickAccept } = useFriendRequestsScoped()
      const request = makeRequest({ userId: '@bob:ex.com' })

      await handleQuickAccept(request)

      expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.error.accept', 'error')
    })

    it('returns early when request has no userId', async () => {
      const { handleQuickAccept } = useFriendRequestsScoped()
      const request = makeRequest({ userId: undefined })

      await handleQuickAccept(request)

      expect(acceptFriendRequestMock).not.toHaveBeenCalled()
    })
  })

  describe('handleQuickReject', () => {
    it('calls rejectFriendRequest and shows success feedback', async () => {
      const { handleQuickReject, processingRequest } = useFriendRequestsScoped()
      const request = makeRequest({ userId: '@bob:ex.com' })

      await handleQuickReject(request)

      expect(rejectFriendRequestMock).toHaveBeenCalledWith('@bob:ex.com')
      expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.success.reject', 'success')
      expect(processingRequest.value).toBeNull()
    })

    it('shows error feedback on failure', async () => {
      rejectFriendRequestMock.mockRejectedValue(new Error('network'))
      const { handleQuickReject } = useFriendRequestsScoped()
      const request = makeRequest({ userId: '@bob:ex.com' })

      await handleQuickReject(request)

      expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.error.reject', 'error')
    })

    it('returns early when request has no userId', async () => {
      const { handleQuickReject } = useFriendRequestsScoped()
      const request = makeRequest({ userId: undefined })

      await handleQuickReject(request)

      expect(rejectFriendRequestMock).not.toHaveBeenCalled()
    })
  })

  describe('watch(incomingRequestsCount) announces new requests', () => {
    it('announces assertively when count increases', async () => {
      contactStoreMock.incomingRequestsCount = 0
      useFriendRequestsScoped()

      // Simulate count increase
      contactStoreMock.incomingRequestsCount = 2
      await nextTick()

      expect(announceMock).toHaveBeenCalledWith('friend.list.new_request_announcement', 'assertive')
    })

    it('does not announce when count decreases', async () => {
      contactStoreMock.incomingRequestsCount = 3
      useFriendRequestsScoped()
      // Clear any announcement from the initial watch setup
      announceMock.mockClear()

      contactStoreMock.incomingRequestsCount = 1
      await nextTick()

      expect(announceMock).not.toHaveBeenCalled()
    })
  })
})
