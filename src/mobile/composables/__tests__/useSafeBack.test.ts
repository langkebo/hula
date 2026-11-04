import { describe, expect, it } from 'vitest'
import { MOBILE_FALLBACK_ROUTE, resolveBackAction } from '../useSafeBack'

describe('resolveBackAction', () => {
  it('有历史记录时回退', () => {
    expect(resolveBackAction('/mobile/message')).toEqual({ type: 'back' })
  })

  it('无历史记录时替换到兜底路由', () => {
    expect(resolveBackAction(null)).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
    expect(resolveBackAction(undefined)).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
    expect(resolveBackAction('')).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
    expect(resolveBackAction(123)).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
  })

  it('支持自定义兜底路由', () => {
    expect(resolveBackAction(null, '/mobile/home')).toEqual({ type: 'replace', path: '/mobile/home' })
  })
})
