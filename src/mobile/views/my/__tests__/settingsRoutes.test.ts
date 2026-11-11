import { describe, expect, it } from 'vitest'
import { MOBILE_MY_SETTINGS_CHILD_ROUTES } from '@/router/routes/mobileMySettingsRoutes'
import {
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LABS_CHILD_ROUTE_SEGMENTS
} from '@/stores/domains/settings/settingsSchema'
import { MOBILE_SETTINGS_SEARCH_ENTRIES } from '../mobileSettingsSearchIndex'
import {
  MOBILE_SETTINGS_HELP_ABOUT_PATH,
  MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH,
  MOBILE_SETTINGS_RELATIVE_PATHS,
  MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
} from '../settingsRoutes'

const MOBILE_SETTINGS_BASE_PATH = '/mobile/mobileMy'

/** 「我的」首屏直达、但不在设置子路由表里的二级页 */
const MOBILE_HUB_ONLY_PATHS = [`${MOBILE_SETTINGS_BASE_PATH}/myMessages`]

describe('settingsRoutes', () => {
  it('keeps mobile canonical paths aligned with the shared settings schema', () => {
    expect(MOBILE_SETTINGS_RELATIVE_PATHS.labs).toBe(SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs)
    expect(MOBILE_SETTINGS_RELATIVE_PATHS.securityPrivacy).toBe(SETTINGS_CANONICAL_ROUTE_SEGMENTS.securityPrivacy)
    expect(MOBILE_SETTINGS_RELATIVE_PATHS.helpAbout).toBe(SETTINGS_CANONICAL_ROUTE_SEGMENTS.helpAbout)
    expect(MOBILE_SETTINGS_RELATIVE_PATHS.labsIntegrations).toBe(
      `${SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs}/${SETTINGS_LABS_CHILD_ROUTE_SEGMENTS.integrations}`
    )
    expect(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH).toBe('/mobile/mobileMy/labs/integrations')
    expect(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH).toBe('/mobile/mobileMy/security-privacy')
    expect(MOBILE_SETTINGS_HELP_ABOUT_PATH).toBe('/mobile/mobileMy/help-about')
  })

  it('indexes every mobile secondary page in the settings search', () => {
    const indexedPaths = new Set(
      MOBILE_SETTINGS_SEARCH_ENTRIES.map((entry) => entry.path).filter((path): path is string => Boolean(path))
    )
    const expectedPaths = [
      ...MOBILE_MY_SETTINGS_CHILD_ROUTES.map((route) => `${MOBILE_SETTINGS_BASE_PATH}/${route.path}`),
      ...MOBILE_HUB_ONLY_PATHS
    ]

    expect(expectedPaths.filter((path) => !indexedPaths.has(path))).toEqual([])
  })
})
