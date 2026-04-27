import {
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LABS_CHILD_ROUTE_SEGMENTS
} from '@/stores/domains/settings/settingsSchema'

export const MOBILE_SETTINGS_BASE_PATH = '/mobile/mobileMy'

export const MOBILE_SETTINGS_RELATIVE_PATHS = {
  labs: SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs,
  labsIntegrations: `${SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs}/${SETTINGS_LABS_CHILD_ROUTE_SEGMENTS.integrations}`,
  securityPrivacy: SETTINGS_CANONICAL_ROUTE_SEGMENTS.securityPrivacy,
  helpAbout: SETTINGS_CANONICAL_ROUTE_SEGMENTS.helpAbout
} as const

export const MOBILE_SETTINGS_LABS_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.labs}`
export const MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.labsIntegrations}`
export const MOBILE_SETTINGS_SECURITY_PRIVACY_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.securityPrivacy}`
export const MOBILE_SETTINGS_HELP_ABOUT_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.helpAbout}`

export const MOBILE_SETTINGS_ROUTE_NAMES = {
  labs: 'mobileLabsSettings',
  labsIntegrations: 'mobileLabsIntegrationsSettings',
  securityPrivacy: 'mobileSecurityPrivacySettings',
  helpAbout: 'mobileHelpAboutSettings'
} as const
