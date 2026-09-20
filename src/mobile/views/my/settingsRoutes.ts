import {
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LABS_CHILD_ROUTE_SEGMENTS
} from '@/stores/domains/settings/settingsSchema'

const MOBILE_SETTINGS_BASE_PATH = '/mobile/mobileMy'

export const MOBILE_SETTINGS_RELATIVE_PATHS = {
  labs: SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs,
  labsIntegrations: `${SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs}/${SETTINGS_LABS_CHILD_ROUTE_SEGMENTS.integrations}`,
  securityPrivacy: SETTINGS_CANONICAL_ROUTE_SEGMENTS.securityPrivacy,
  password: 'password',
  ignoredUsers: 'ignoredUsers',
  simpleBio: 'simpleBio',
  securityKey: 'securityKey',
  storage: 'storage',
  pushSettings: 'pushSettings',
  invitePermission: 'invitePermission',
  devices: 'devices',
  deactivateAccount: 'deactivateAccount',
  helpAbout: SETTINGS_CANONICAL_ROUTE_SEGMENTS.helpAbout
} as const

export const MOBILE_SETTINGS_LABS_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.labs}`
export const MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.labsIntegrations}`
export const MOBILE_SETTINGS_SECURITY_PRIVACY_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.securityPrivacy}`
export const MOBILE_SETTINGS_PASSWORD_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.password}`
export const MOBILE_SETTINGS_IGNORED_USERS_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.ignoredUsers}`
export const MOBILE_SETTINGS_SECURITY_KEY_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.securityKey}`
export const MOBILE_SETTINGS_STORAGE_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.storage}`
export const MOBILE_SETTINGS_PUSH_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.pushSettings}`
export const MOBILE_SETTINGS_INVITE_PERMISSION_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.invitePermission}`
export const MOBILE_SETTINGS_DEVICES_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.devices}`
export const MOBILE_SETTINGS_DEACTIVATE_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.deactivateAccount}`
export const MOBILE_SETTINGS_HELP_ABOUT_PATH = `${MOBILE_SETTINGS_BASE_PATH}/${MOBILE_SETTINGS_RELATIVE_PATHS.helpAbout}`

export const MOBILE_SETTINGS_ROUTE_NAMES = {
  labs: 'mobileLabsSettings',
  labsIntegrations: 'mobileLabsIntegrationsSettings',
  securityPrivacy: 'mobileSecurityPrivacySettings',
  password: 'mobilePasswordSettings',
  ignoredUsers: 'mobileIgnoredUsers',
  securityKey: 'mobileSecurityKeySetup',
  storage: 'mobileStorageSettings',
  pushSettings: 'mobilePushSettings',
  invitePermission: 'mobileInvitePermission',
  devices: 'mobileDeviceManagement',
  deactivateAccount: 'mobileDeactivateAccount',
  helpAbout: 'mobileHelpAboutSettings'
} as const
