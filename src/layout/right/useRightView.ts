import { computed } from 'vue'
import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'
import type { RightViewType } from './types'

/**
 * 右侧栏视图状态 composable
 *
 * 从当前路由路径派生 RightViewType，并通过路由跳转切换视图。
 * 参考需求文档第 5.3 节：路由为右侧栏视图状态的单一真相源。
 *
 * 路由 → 视图映射：
 * - /friend              → empty
 * - /friend/add          → addFriend
 * - /friend/requests     → applyList
 * - /friend/:userId      → details
 * - /room                → empty
 * - /room/create         → createRoom
 * - /room/join           → joinRoom
 * - /room/:roomId        → details
 * - /space               → empty
 * - /space/create        → createSpace
 * - /space/:spaceId      → spaceChildren
 * - /message/:roomId?    → chat（有 roomId 时）/ empty（无 roomId）
 * - /search              → search
 */
export function useRightView() {
  const route = useRoute()
  const router = useRouter()

  const rightView = computed<RightViewType>(() => {
    const path = route.path

    // /friend 系列
    if (path === '/friend' || path === '/friendsList') return 'empty'
    if (path === '/friend/add') return 'addFriend'
    if (path === '/friend/requests') return 'applyList'
    if (/^\/friend\/[^/]+$/.test(path)) return 'details'

    // /room 系列
    if (path === '/room' || path === '/roomList') return 'empty'
    if (path === '/room/create') return 'createRoom'
    if (path === '/room/join') return 'joinRoom'
    if (/^\/room\/[^/]+$/.test(path)) return 'details'

    // /space 系列
    if (path === '/space' || path === '/spaceList') return 'empty'
    if (path === '/space/create') return 'createSpace'
    if (/^\/space\/[^/]+$/.test(path)) return 'spaceChildren'

    // /message 系列 - 有 roomId 时显示 chat
    if (/^\/message(\/[^/]+)?$/.test(path)) {
      return route.params.roomId ? 'chat' : 'empty'
    }

    // /search
    if (path === '/search') return 'search'

    return 'empty'
  })

  const currentParams = computed(() => ({
    userId: route.params.userId as string | undefined,
    roomId: route.params.roomId as string | undefined,
    spaceId: route.params.spaceId as string | undefined
  }))

  const buildViewRoute = (
    view: RightViewType,
    params?: { userId?: string; roomId?: string; spaceId?: string }
  ): RouteLocationRaw => {
    switch (view) {
      case 'empty':
        return '/friend'
      case 'details':
        if (params?.userId) return { name: 'friend-details', params: { userId: params.userId } }
        if (params?.roomId) return { name: 'room-details', params: { roomId: params.roomId } }
        return '/friend'
      case 'addFriend':
        return { name: 'friend-add' }
      case 'applyList':
        return { name: 'friend-requests' }
      case 'createRoom':
        return { name: 'room-create' }
      case 'joinRoom':
        return { name: 'room-join' }
      case 'createSpace':
        return { name: 'space-create' }
      case 'spaceChildren':
        if (params?.spaceId) return { name: 'space-details', params: { spaceId: params.spaceId } }
        return '/space'
      case 'chat':
        if (params?.roomId) return { name: 'message', params: { roomId: params.roomId } }
        return '/message'
      case 'search':
        return { name: 'search', query: (route.query.q ? { q: route.query.q as string } : {}) as LocationQueryRaw }
      default:
        return '/friend'
    }
  }

  const switchView = (view: RightViewType, params?: { userId?: string; roomId?: string; spaceId?: string }) => {
    const target = buildViewRoute(view, params)
    return router.push(target)
  }

  return {
    rightView,
    currentParams,
    switchView,
    buildViewRoute
  }
}
