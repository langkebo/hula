import type { RouteRecordRaw } from 'vue-router'
import { MOBILE_SETTINGS_RELATIVE_PATHS, MOBILE_SETTINGS_ROUTE_NAMES } from '@/mobile/views/my/settingsRoutes'

const BurnAfterReadSettings = () => import('#/views/my/BurnAfterReadSettings.vue')
const DeviceManagement = () => import('#/views/my/DeviceManagement.vue')
const EncryptionSettings = () => import('#/views/my/EncryptionSettings.vue')
const Files = () => import('#/views/my/Files.vue')
const HelpFeedback = () => import('#/views/my/HelpFeedback.vue')
const HomeserverSettings = () => import('@/mobile/views/my/HomeserverSettings.vue')
const IntegrationsSettings = () => import('#/views/my/IntegrationsSettings.vue')
const LabsSettings = () => import('#/views/my/LabsSettings.vue')
const MobileDeactivateAccount = () => import('#/views/my/MobileDeactivateAccount.vue')
const MobileEmojiManager = () => import('#/views/my/MobileEmojiManager.vue')
const MobileNotificationHistory = () => import('@/mobile/views/my/MobileNotificationHistory.vue')
const MobileIgnoredUsers = () => import('#/views/my/MobileIgnoredUsers.vue')
const MobileInvitePermission = () => import('#/views/my/MobileInvitePermission.vue')
const MobilePushSettings = () => import('#/views/my/MobilePushSettings.vue')
const MobileSecurityKeySetup = () => import('#/views/my/MobileSecurityKeySetup.vue')
const MobileStorageSettings = () => import('#/views/my/MobileStorageSettings.vue')
const NotificationSettings = () => import('#/views/my/NotificationSettings.vue')
const PasswordSettings = () => import('#/views/my/PasswordSettings.vue')
const PreferencesSettings = () => import('#/views/my/PreferencesSettings.vue')
const SecuritySettings = () => import('#/views/my/SecuritySettings.vue')
const SimpleBio = () => import('#/views/my/SimpleBio.vue')
const VoiceVideoSettings = () => import('#/views/my/VoiceVideoSettings.vue')

/**
 * 「我的 → 设置」下的二级页面（设备、密码、加密、存储、推送……）。
 *
 * 从 `mobile.ts` 搬出来：路由表原本是一个文件，逐页追加后已超出体积基线，
 * 而这 20 条子路由各自独立、彼此无耦合，整块搬走不影响任何调用方
 * （`mobile.ts` 只用 `...MOBILE_MY_SETTINGS_CHILD_ROUTES` 展开）。
 */
export const MOBILE_MY_SETTINGS_CHILD_ROUTES: RouteRecordRaw[] = [
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.securityPrivacy,
    name: MOBILE_SETTINGS_ROUTE_NAMES.securityPrivacy,
    component: SecuritySettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.devices,
    name: MOBILE_SETTINGS_ROUTE_NAMES.devices,
    component: DeviceManagement
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.password,
    name: MOBILE_SETTINGS_ROUTE_NAMES.password,
    component: PasswordSettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.ignoredUsers,
    name: MOBILE_SETTINGS_ROUTE_NAMES.ignoredUsers,
    component: MobileIgnoredUsers
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.simpleBio,
    name: 'mobileSimpleBio',
    component: SimpleBio
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.securityKey,
    name: MOBILE_SETTINGS_ROUTE_NAMES.securityKey,
    component: MobileSecurityKeySetup
  },
  {
    // 加密设置与其余二级页同构，挂在 MyLayout 内，保证有 TabBar 壳与返回逻辑
    path: MOBILE_SETTINGS_RELATIVE_PATHS.encryption,
    name: MOBILE_SETTINGS_ROUTE_NAMES.encryption,
    component: EncryptionSettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.storage,
    name: MOBILE_SETTINGS_ROUTE_NAMES.storage,
    component: MobileStorageSettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.pushSettings,
    name: MOBILE_SETTINGS_ROUTE_NAMES.pushSettings,
    component: MobilePushSettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.invitePermission,
    name: MOBILE_SETTINGS_ROUTE_NAMES.invitePermission,
    component: MobileInvitePermission
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.deactivateAccount,
    name: MOBILE_SETTINGS_ROUTE_NAMES.deactivateAccount,
    component: MobileDeactivateAccount
  },
  {
    path: 'notifications',
    name: 'mobileNotificationSettings',
    component: NotificationSettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.helpAbout,
    name: MOBILE_SETTINGS_ROUTE_NAMES.helpAbout,
    component: HelpFeedback
  },
  {
    path: 'voiceVideo',
    name: 'mobileVoiceVideoSettings',
    component: VoiceVideoSettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.labs,
    name: MOBILE_SETTINGS_ROUTE_NAMES.labs,
    component: LabsSettings
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.labsIntegrations,
    name: MOBILE_SETTINGS_ROUTE_NAMES.labsIntegrations,
    component: IntegrationsSettings
  },
  {
    path: 'homeserver',
    name: 'mobileHomeserverSettings',
    component: HomeserverSettings
  },
  {
    path: 'files',
    name: 'mobileFiles',
    component: Files
  },
  {
    path: 'burnAfterRead',
    name: 'mobileBurnAfterReadSettings',
    component: BurnAfterReadSettings
  },
  {
    path: 'preferences',
    name: 'mobilePreferencesSettings',
    component: PreferencesSettings
  },
  {
    // 表情包管理：实现早已存在（255 行）但既无路由也无入口，等于不存在
    path: MOBILE_SETTINGS_RELATIVE_PATHS.emoticons,
    name: MOBILE_SETTINGS_ROUTE_NAMES.emoticons,
    component: MobileEmojiManager
  },
  {
    path: MOBILE_SETTINGS_RELATIVE_PATHS.notificationHistory,
    name: MOBILE_SETTINGS_ROUTE_NAMES.notificationHistory,
    component: MobileNotificationHistory
  }
]
