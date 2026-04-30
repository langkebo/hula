import { describe, expect, it } from 'vitest'
import {
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LABS_CHILD_ROUTE_SEGMENTS
} from '@/stores/domains/settings/settingsSchema'
import {
  MOBILE_SETTINGS_HELP_ABOUT_PATH,
  MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH,
  MOBILE_SETTINGS_RELATIVE_PATHS,
  MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
} from '../settingsRoutes'

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
})
