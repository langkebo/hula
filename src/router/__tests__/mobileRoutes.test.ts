import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'
import {
  MOBILE_SETTINGS_HELP_ABOUT_PATH,
  MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH,
  MOBILE_SETTINGS_LEGACY_INTEGRATIONS_PATH,
  MOBILE_SETTINGS_LEGACY_HELP_PATH,
  MOBILE_SETTINGS_LEGACY_SECURITY_PATH,
  MOBILE_SETTINGS_ROUTE_NAMES,
  MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
} from '@/mobile/views/my/settingsRoutes'
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

  it('keeps the legacy integrations link as a redirect', () => {
    const routes = flattenRoutes(getMobileRoutes())
    const legacyRoute = routes.find((route) => route.path === 'integrations')

    expect(legacyRoute).toBeDefined()
    expect(MOBILE_SETTINGS_LEGACY_INTEGRATIONS_PATH).toBe('/mobile/mobileMy/integrations')
    expect(legacyRoute?.redirect).toBe(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
  })

  it('redirects legacy integrations navigation to the labs subpage', async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

    await router.push(MOBILE_SETTINGS_LEGACY_INTEGRATIONS_PATH)
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
    expect(router.currentRoute.value.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.labsIntegrations)
  }, 10000)

  it('redirects the legacy security path to security-privacy', async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

    await router.push(MOBILE_SETTINGS_LEGACY_SECURITY_PATH)
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
    expect(router.currentRoute.value.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.securityPrivacy)
  }, 10000)

  it('redirects the legacy help path to help-about', async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

    await router.push(MOBILE_SETTINGS_LEGACY_HELP_PATH)
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe(MOBILE_SETTINGS_HELP_ABOUT_PATH)
    expect(router.currentRoute.value.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.helpAbout)
  })
})
