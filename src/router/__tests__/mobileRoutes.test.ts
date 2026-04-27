import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'
import {
  MOBILE_SETTINGS_HELP_ABOUT_PATH,
  MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH,
  MOBILE_SETTINGS_ROUTE_NAMES,
  MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
} from '@/mobile/views/my/settingsRoutes'
import { getCommonRoutes } from '@/router/routes/common'
import { getMobileRoutes } from '@/router/routes/mobile'

function flattenRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.flatMap((route) => [route, ...(route.children ? flattenRoutes(route.children) : [])])
}

describe('getMobileRoutes', () => {
  let router: Router | null = null

  beforeEach(() => {
    // 每个测试前清理路由实例
    router = null
  })

  afterEach(async () => {
    // 每个测试后清理路由实例
    if (router) {
      await router.push('/')
      router = null
    }
  })
  it('nests integrations under labs for mobile settings', () => {
    const routes = flattenRoutes(getMobileRoutes())
    const integrationsRoute = routes.find((route) => route.path === 'labs/integrations')

    expect(integrationsRoute).toBeDefined()
    expect(integrationsRoute?.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.labsIntegrations)
  })

  it('keeps the canonical security path stable', async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

    await router.push(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
    await router.isReady()
    expect(router.currentRoute.value.fullPath).toBe(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
    expect(router.currentRoute.value.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.securityPrivacy)
  }, 10000)

  it('keeps the canonical help path stable', async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

    await router.push(MOBILE_SETTINGS_HELP_ABOUT_PATH)
    await router.isReady()
    expect(router.currentRoute.value.fullPath).toBe(MOBILE_SETTINGS_HELP_ABOUT_PATH)
    expect(router.currentRoute.value.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.helpAbout)
  }, 10000)

  it('keeps the canonical integrations path stable', async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

    await router.push(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
    expect(router.currentRoute.value.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.labsIntegrations)
  }, 10000)

  it('keeps manage group member under mobile chat routes only', async () => {
    const mobileRoutes = flattenRoutes(getMobileRoutes())
    const commonRoutes = flattenRoutes(getCommonRoutes())
    const manageGroupMemberRoute = mobileRoutes.find((route) => route.name === 'manageGroupMember')

    expect(manageGroupMemberRoute).toBeDefined()
    expect(manageGroupMemberRoute?.path).toBe('manageGroupMember')
    expect(commonRoutes.some((route) => route.name === 'manageGroupMember')).toBe(false)

    router = createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

    await router.push({ name: 'manageGroupMember' })
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe('/mobile/chatRoom/manageGroupMember')
    expect(router.currentRoute.value.name).toBe('manageGroupMember')
  }, 10000)
})
