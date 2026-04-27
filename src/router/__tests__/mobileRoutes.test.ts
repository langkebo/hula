import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'
import {
  MOBILE_SETTINGS_HELP_ABOUT_PATH,
  MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH,
  MOBILE_SETTINGS_ROUTE_NAMES,
  MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
} from '@/mobile/views/my/settingsRoutes'
import { getCommonRoutes } from '@/router/routes/common'
import { getMobileRoutes } from '@/router/routes/mobile'

vi.mock('#/views/my/SecuritySettings.vue', () => ({
  default: { name: 'SecuritySettings', template: '<div>Security</div>' }
}))

vi.mock('#/views/my/HelpSettings.vue', () => ({
  default: { name: 'HelpSettings', template: '<div>Help</div>' }
}))

vi.mock('#/views/my/LabsSettings.vue', () => ({
  default: { name: 'LabsSettings', template: '<div>Labs</div>' }
}))

function flattenRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.flatMap((route) => [route, ...(route.children ? flattenRoutes(route.children) : [])])
}

describe('getMobileRoutes', () => {
  const createMobileRouter = (): Router =>
    createRouter({
      history: createMemoryHistory(),
      routes: getMobileRoutes()
    })

  it('nests integrations under labs for mobile settings', () => {
    const routes = flattenRoutes(getMobileRoutes())
    const integrationsRoute = routes.find((route) => route.path === 'labs/integrations')

    expect(integrationsRoute).toBeDefined()
    expect(integrationsRoute?.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.labsIntegrations)
  })

  it('keeps the canonical security path stable', () => {
    const resolvedRoute = createMobileRouter().resolve(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)

    expect(resolvedRoute.fullPath).toBe(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
    expect(resolvedRoute.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.securityPrivacy)
  })

  it('keeps the canonical help path stable', () => {
    const resolvedRoute = createMobileRouter().resolve(MOBILE_SETTINGS_HELP_ABOUT_PATH)

    expect(resolvedRoute.fullPath).toBe(MOBILE_SETTINGS_HELP_ABOUT_PATH)
    expect(resolvedRoute.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.helpAbout)
  })

  it('keeps the canonical integrations path stable', () => {
    const resolvedRoute = createMobileRouter().resolve(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)

    expect(resolvedRoute.fullPath).toBe(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
    expect(resolvedRoute.name).toBe(MOBILE_SETTINGS_ROUTE_NAMES.labsIntegrations)
  })

  it('keeps manage group member under mobile chat routes only', () => {
    const mobileRoutes = flattenRoutes(getMobileRoutes())
    const commonRoutes = flattenRoutes(getCommonRoutes())
    const manageGroupMemberRoute = mobileRoutes.find((route) => route.name === 'manageGroupMember')

    expect(manageGroupMemberRoute).toBeDefined()
    expect(manageGroupMemberRoute?.path).toBe('manageGroupMember')
    expect(commonRoutes.some((route) => route.name === 'manageGroupMember')).toBe(false)

    const resolvedRoute = createMobileRouter().resolve({ name: 'manageGroupMember' })

    expect(resolvedRoute.fullPath).toBe('/mobile/chatRoom/manageGroupMember')
    expect(resolvedRoute.name).toBe('manageGroupMember')
  })
})
