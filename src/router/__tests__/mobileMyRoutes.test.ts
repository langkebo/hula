import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { MOBILE_SETTINGS_ENCRYPTION_PATH } from '@/mobile/views/my/settingsRoutes'
import { getMobileRoutes } from '@/router/routes/mobile'

interface FlatRoute {
  name: string | undefined
  path: string
  parentNames: string[]
}

/** 深度优先展开路由树，保留父链名称以便断言嵌套关系。 */
function flatten(routes: RouteRecordRaw[], parentNames: string[] = []): FlatRoute[] {
  return routes.flatMap((route) => {
    if (!route) return []
    const name = typeof route.name === 'string' ? route.name : undefined
    const children = (route as { children?: RouteRecordRaw[] }).children ?? []
    return [{ name, path: route.path, parentNames }, ...flatten(children, name ? [...parentNames, name] : parentNames)]
  })
}

const flatRoutes = flatten(getMobileRoutes())

describe('mobileMy routes', () => {
  it('keeps every route name unique across the mobile tree', () => {
    const names = flatRoutes.map((item) => item.name).filter((name): name is string => Boolean(name))
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)

    // 重名会让后注册者覆盖前者的 name 解析，深链与 router.push({ name }) 都会跳错页面
    expect([...new Set(duplicates)]).toEqual([])
  })

  it('mounts the encryption page inside MyLayout', () => {
    const encryption = flatRoutes.find((item) => item.name === 'mobileEncryption')

    expect(encryption).toBeDefined()
    expect(encryption?.parentNames).toContain('mobileMyLayout')
    expect(`/mobile/mobileMy/${encryption?.path}`).toBe(MOBILE_SETTINGS_ENCRYPTION_PATH)
  })

  it('registers SimpleBio exactly once, under the settings child routes', () => {
    const simpleBioRoutes = flatRoutes.filter((item) => item.name === 'mobileSimpleBio')

    expect(simpleBioRoutes).toHaveLength(1)
    expect(simpleBioRoutes[0]?.parentNames).toContain('mobileMyLayout')
  })
})
