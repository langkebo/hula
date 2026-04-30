import { describe, expect, it } from 'vitest'
import { getDesktopRoutes } from '@/router/routes/desktop'
import { SPACE_ROUTE_NAMES } from '@/router/spaceNavigation'

describe('desktopRoutes', () => {
  it('keeps canonical desktop settings aliases and removes camelCase duplicates', () => {
    const routes = getDesktopRoutes()
    const paths = routes.map((route) => route.path)

    expect(paths).toContain('/security-privacy')
    expect(paths).toContain('/help-about')
    expect(paths).not.toContain('/securityPrivacy')
    expect(paths).not.toContain('/helpAbout')
    expect(paths).not.toContain('/versatile')
  })

  it('does not expose the deprecated search details route', () => {
    const homeRoute = getDesktopRoutes().find((route) => route.name === 'home')
    const childPaths = homeRoute?.children?.map((route) => route.path) ?? []

    expect(childPaths).not.toContain('/searchDetails')
  })

  it('keeps the dedicated create-space route ahead of the legacy redirect route', () => {
    const routes = getDesktopRoutes()
    const createRouteIndex = routes.findIndex((route) => route.name === SPACE_ROUTE_NAMES.create)
    const legacyRouteIndex = routes.findIndex((route) => route.name === SPACE_ROUTE_NAMES.legacy)

    expect(createRouteIndex).toBeGreaterThan(-1)
    expect(legacyRouteIndex).toBeGreaterThan(-1)
    expect(routes[createRouteIndex]?.path).toBe('/space/create')
    expect(createRouteIndex).toBeLessThan(legacyRouteIndex)
  })
})
