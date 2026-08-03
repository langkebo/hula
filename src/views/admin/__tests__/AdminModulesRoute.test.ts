import { describe, expect, it } from 'vitest'

describe('AdminModules route', () => {
  it('has /admin/modules route', async () => {
    const { getDesktopRoutes } = await import('@/router/routes/desktop')
    const routes = getDesktopRoutes()
    const adminRoute = routes.find((r) => r.path === '/admin')
    expect(adminRoute).toBeTruthy()
    const adminModulesRoute = adminRoute?.children?.find((r) => r.path === '/admin/modules')
    expect(adminModulesRoute).toBeTruthy()
  })
})
