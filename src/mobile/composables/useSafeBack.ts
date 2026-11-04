import router from '@/router'

export const MOBILE_FALLBACK_ROUTE = '/mobile/message'

export type BackAction = { type: 'back' } | { type: 'replace'; path: string }

export function resolveBackAction(historyBack: unknown, fallback: string = MOBILE_FALLBACK_ROUTE): BackAction {
  if (typeof historyBack === 'string' && historyBack.length > 0) {
    return { type: 'back' }
  }
  return { type: 'replace', path: fallback }
}

export function useSafeBack(fallback: string = MOBILE_FALLBACK_ROUTE) {
  const goBack = () => {
    const action = resolveBackAction(window.history.state?.back, fallback)
    if (action.type === 'back') {
      router.back()
      return
    }
    router.replace(action.path)
  }

  return { goBack }
}
