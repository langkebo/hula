/**
 * 后台管理路由与入口门控守卫（方案 §13.11「管理端每页路由/菜单/权限门控」离线判据）
 *
 * 覆盖三件事：
 * 1. 桌面端所有挂在 /admin 下、带组件的路由都必须声明 meta.requiresAdmin；
 * 2. 移动端路由表不得出现任何 /admin 路径（R2 移动端裁剪）；
 * 3. 后台侧边导航的每个 path 都必须能在桌面路由表中找到（菜单不指向空路由）。
 *
 * 运行时鉴权行为本身由 src/router/authGuard.ts 的用例与 e2e 覆盖，本文件只锁静态装配。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { getDesktopRoutes } from '@/router/routes/desktop'
import { getMobileRoutes } from '@/router/routes/mobile'

interface FlatRoute {
  path: string
  name: string
  requiresAdmin: boolean
  hasComponent: boolean
}

const joinPath = (parentPath: string, childPath: string): string => {
  if (childPath.startsWith('/')) return childPath
  if (!childPath) return parentPath
  return `${parentPath.replace(/\/$/, '')}/${childPath}`
}

function flattenRoutes(routes: RouteRecordRaw[], parentPath = ''): FlatRoute[] {
  return routes.flatMap((route) => {
    const path = joinPath(parentPath, route.path)
    const children = 'children' in route && Array.isArray(route.children) ? route.children : []
    const meta = ('meta' in route ? route.meta : undefined) as Record<string, unknown> | undefined
    const current: FlatRoute = {
      path,
      name: String(('name' in route ? route.name : undefined) ?? ''),
      requiresAdmin: meta?.requiresAdmin === true,
      hasComponent: 'component' in route && Boolean(route.component)
    }
    return [current, ...flattenRoutes(children, path)]
  })
}

const desktopRoutes = flattenRoutes(getDesktopRoutes())
const mobileRoutes = flattenRoutes(getMobileRoutes())
const ADMIN_PATH = /^\/admin(\/|$)/
const desktopAdminRoutes = desktopRoutes.filter((route) => ADMIN_PATH.test(route.path))

const ADMIN_NAV_FILE = resolve(__dirname, '..', '..', 'views', 'admin', 'useAdminNav.ts')

function readAdminNavPaths(): string[] {
  const source = readFileSync(ADMIN_NAV_FILE, 'utf-8')
  const matches = source.matchAll(/path:\s*'(\/admin\/[^']+)'/g)
  return [...matches].map((match) => match[1])
}

describe('后台路由门控', () => {
  it('桌面端 /admin 分支下带组件的路由全部声明 requiresAdmin', () => {
    const unprotected = desktopAdminRoutes
      .filter((route) => route.hasComponent && !route.requiresAdmin)
      .map((route) => `${route.path} (${route.name})`)

    expect(unprotected, `以下后台路由缺少 meta.requiresAdmin：${unprotected.join(', ')}`).toEqual([])
  })

  it('后台路由数量应大于 20（防止整个 /admin 分支被删除后用例假通过）', () => {
    expect(desktopAdminRoutes.filter((route) => route.hasComponent).length).toBeGreaterThan(20)
  })

  it('移动端路由表不得包含任何 /admin 路径', () => {
    const leaked = mobileRoutes.filter((route) => ADMIN_PATH.test(route.path)).map((route) => route.path)
    expect(leaked, `移动端路由不应出现后台路径：${leaked.join(', ')}`).toEqual([])
  })

  it('后台导航的每个 path 都能在桌面路由表中找到', () => {
    const navPaths = readAdminNavPaths()
    expect(navPaths.length, '未能从 useAdminNav.ts 解析出任何后台导航项').toBeGreaterThan(0)

    const routePaths = new Set(desktopAdminRoutes.map((route) => route.path))
    const orphans = navPaths.filter((path) => !routePaths.has(path))
    expect(orphans, `以下后台导航项没有对应路由：${orphans.join(', ')}`).toEqual([])
  })

  it('403 页只存在于桌面端', () => {
    expect(desktopRoutes.some((route) => route.path === '/403')).toBe(true)
    expect(mobileRoutes.some((route) => route.path === '/403')).toBe(false)
  })
})
