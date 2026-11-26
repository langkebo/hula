import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { getDesktopRoutes } from '@/router/routes/desktop'

const findByName = (routes: readonly RouteRecordRaw[], name: string): RouteRecordRaw | null => {
  for (const route of routes) {
    if (route.name === name) return route
    if (route.children) {
      const matched = findByName(route.children, name)
      if (matched) return matched
    }
  }
  return null
}

describe('设置页内嵌路由契约', () => {
  const routes = getDesktopRoutes()

  it('设置页是 home 的子路由，切换设置时 layout 不卸载', () => {
    const home = findByName(routes, 'home')
    expect(home?.children?.some((child) => child.name === 'settings')).toBe(true)
  })

  it('设置页标记 meta.fullWindow 并保留绝对路径 /settings', () => {
    const settings = findByName(routes, 'settings')
    expect(settings?.path).toBe('/settings')
    expect(settings?.meta?.fullWindow).toBe(true)
  })

  it('设置页不再作为顶层路由重复注册', () => {
    expect(routes.some((route) => route.name === 'settings')).toBe(false)
  })

  it('旧路径 redirect 仍指向设置页对应 tab', () => {
    const legacy = routes.find((route) => route.path === '/notification')
    expect(legacy?.redirect).toBe('/settings?tab=notifications')
  })
})
