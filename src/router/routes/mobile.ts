import type { RouteRecordRaw } from 'vue-router'
import {
  MOBILE_SETTINGS_RELATIVE_PATHS,
  MOBILE_SETTINGS_HELP_ABOUT_PATH,
  MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH,
  MOBILE_SETTINGS_ROUTE_NAMES,
  MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
} from '@/mobile/views/my/settingsRoutes'

const ChatRoomLayout = () => import('#/layout/chat-room/ChatRoomLayout.vue')
const NoticeLayout = () => import('#/layout/chat-room/NoticeLayout.vue')
const FriendsLayout = () => import('#/layout/friends/FriendsLayout.vue')
const MobileHome = () => import('#/layout/index.vue')
const GroupChatMember = () => import('#/views/chat-room/GroupChatMember.vue')
const MobileInviteGroupMember = () => import('#/views/chat-room/MobileInviteGroupMember.vue')
const MyLayout = () => import('#/layout/my/MyLayout.vue')
const MobileLogin = () => import('#/login.vue')
const ChatSetting = () => import('#/views/chat-room/ChatSetting.vue')
const MobileChatMain = () => import('#/views/chat-room/MobileChatMain.vue')
const SearchChatContent = () => import('#/views/chat-room/SearchChatContent.vue')
const MediaViewer = () => import('#/views/chat-room/MediaViewer.vue')
const NoticeDetail = () => import('#/views/chat-room/notice/NoticeDetail.vue')
const NoticeEdit = () => import('#/views/chat-room/notice/NoticeEdit.vue')
const NoticeList = () => import('#/views/chat-room/notice/NoticeList.vue')
const MobileThreadView = () => import('#/components/thread/ThreadView.vue')
const ConfirmAddGroup = () => import('#/views/friends/ConfirmAddGroup.vue')
const ConfirmAddFriend = () => import('#/views/friends/ConfirmAddFriend.vue')
const AddFriends = () => import('#/views/friends/AddFriends.vue')
const FriendInfo = () => import('#/views/friends/FriendInfo.vue')
const MobileFriendPage = () => import('#/views/friends/index.vue')
const StartGroupChat = () => import('#/views/friends/StartGroupChat.vue')
const MobileMessagePage = () => import('#/views/message/index.vue')
const MobileDynamicPage = () => import('#/views/dynamic/index.vue')
const MobileDynamicDetail = () => import('#/views/dynamic/detail.vue')
const EditBio = () => import('#/views/my/EditBio.vue')
const EditBirthday = () => import('#/views/my/EditBirthday.vue')
const EditProfile = () => import('#/views/my/EditProfile.vue')
const MobileMy = () => import('#/views/my/index.vue')
const MobileQRCode = () => import('#/views/my/MobileQRCode.vue')
const MobileSettings = () => import('#/views/my/MobileSettings.vue')
const HomeserverSettings = () => import('@/mobile/views/my/HomeserverSettings.vue')
const MyMessages = () => import('#/views/my/MyMessages.vue')
const Share = () => import('#/views/my/Share.vue')
const SimpleBio = () => import('#/views/my/SimpleBio.vue')
const AiAssistant = () => import('#/views/my/AiAssistant.vue')
const MyAlbum = () => import('#/views/my/MyAlbum.vue')
const StatusSettings = () => import('#/views/my/StatusSettings.vue')
const SecuritySettings = () => import('#/views/my/SecuritySettings.vue')
const DeviceManagement = () => import('#/views/my/DeviceManagement.vue')
const NotificationSettings = () => import('#/views/my/NotificationSettings.vue')
const HelpFeedback = () => import('#/views/my/HelpFeedback.vue')
const VoiceVideoSettings = () => import('#/views/my/VoiceVideoSettings.vue')
const LabsSettings = () => import('#/views/my/LabsSettings.vue')
const IntegrationsSettings = () => import('#/views/my/IntegrationsSettings.vue')
const BurnAfterReadSettings = () => import('#/views/my/BurnAfterReadSettings.vue')
const MjolnirSettings = () => import('#/views/my/MjolnirSettings.vue')
const PreferencesSettings = () => import('#/views/my/PreferencesSettings.vue')
const Favorites = () => import('#/views/my/Favorites.vue')
const Files = () => import('#/views/my/Files.vue')
const ConfirmQRLogin = () => import('#/views/ConfirmQRLogin.vue')
const MyQRCode = () => import('#/views/MyQRCode.vue')
const Splashscreen = () => import('#/views/Splashscreen.vue')
const MobileForgetPassword = () => import('#/views/MobileForgetPassword.vue')
const MobileServiceAgreement = () => import('#/views/MobileServiceAgreement.vue')
const MobilePrivacyAgreement = () => import('#/views/MobilePrivacyAgreement.vue')
const SyncData = () => import('#/views/SyncData.vue')

export const getMobileRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/',
    name: 'mobileRoot',
    redirect: '/mobile/login'
  },
  {
    path: '/mobile/login',
    name: 'mobileLogin',
    component: MobileLogin
  },
  {
    path: '/mobile/MobileForgetPassword',
    name: 'mobileForgetPassword',
    component: MobileForgetPassword
  },
  {
    path: '/mobile/splashscreen',
    name: 'splashscreen',
    component: Splashscreen
  },
  {
    path: '/mobile/serviceAgreement',
    name: 'mobileServiceAgreement',
    component: MobileServiceAgreement
  },
  {
    path: '/mobile/privacyAgreement',
    name: 'mobilePrivacyAgreement',
    component: MobilePrivacyAgreement
  },
  {
    path: '/mobile/syncData',
    name: 'mobileSyncData',
    component: SyncData
  },
  {
    path: '/mobile/chatRoom',
    name: 'mobileChatRoom',
    component: ChatRoomLayout,
    children: [
      {
        path: '',
        name: 'mobileChatRoomDefault',
        redirect: '/mobile/chatRoom/chatMain'
      },
      {
        path: 'chatMain/:uid?',
        name: 'mobileChatMain',
        component: MobileChatMain,
        props: true,
        meta: { keepAlive: true }
      },
      {
        path: 'setting',
        name: 'mobileChatSetting',
        component: ChatSetting
      },
      {
        path: 'searchContent',
        name: 'mobileSearchChatContent',
        component: SearchChatContent
      },
      {
        path: 'mediaViewer',
        name: 'mobileMediaViewer',
        component: MediaViewer
      },
      {
        path: 'groupChatMember',
        name: 'mobileGroupChatMember',
        component: GroupChatMember,
        meta: { keepAlive: true }
      },
      {
        path: 'inviteGroupMember',
        name: 'mobileInviteGroupMember',
        component: MobileInviteGroupMember
      },
      {
        path: 'thread/:roomId/:threadRootId',
        name: 'mobileThreadView',
        component: MobileThreadView,
        props: true
      },
      {
        path: 'notice',
        name: 'mobileChatNotice',
        component: NoticeLayout,
        children: [
          {
            path: '',
            name: 'mobileChatNoticeList',
            component: NoticeList
          },
          {
            path: 'add',
            name: 'mobileChatNoticeAdd',
            component: NoticeEdit
          },
          {
            path: 'edit/:id',
            name: 'mobileChatNoticeEdit',
            component: NoticeEdit
          },
          {
            path: 'detail/:id',
            name: 'mobileChatNoticeDetail',
            component: NoticeDetail
          }
        ]
      }
    ]
  },
  {
    path: '/mobile/home',
    name: 'mobileHome',
    component: MobileHome,
    children: [
      {
        path: '',
        name: 'mobileHomeDefault',
        redirect: '/mobile/message'
      },
      {
        path: '/mobile/message',
        name: 'mobileMessage',
        component: MobileMessagePage
      },
      {
        path: '/mobile/friends',
        name: 'mobileFriends',
        component: MobileFriendPage
      },
      {
        path: '/mobile/my',
        name: 'mobileMy',
        component: MobileMy
      },
      {
        path: '/mobile/dynamic',
        name: 'mobileDynamic',
        component: MobileDynamicPage
      },
      {
        path: '/mobile/dynamic/:id',
        name: 'mobileDynamicDetail',
        component: MobileDynamicDetail
      }
    ]
  },
  {
    path: '/mobile/mobileMy',
    name: 'mobileMyLayout',
    component: MyLayout,
    children: [
      {
        path: '',
        name: 'mobileMyDefault',
        redirect: '/mobile/mobileMy/editProfile'
      },
      {
        path: 'editProfile',
        name: 'mobileEditProfile',
        component: EditProfile
      },
      {
        path: 'myMessages',
        name: 'mobileMyMessages',
        component: MyMessages
      },
      {
        path: 'editBio',
        name: 'mobileEditBio',
        component: EditBio
      },
      {
        path: 'editBirthday',
        name: 'mobileEditBirthday',
        component: EditBirthday
      },
      {
        path: 'settings',
        name: 'MobileSettings',
        component: MobileSettings
      },
      {
        path: 'scanQRCode',
        name: 'mobileQRCode',
        component: MobileQRCode
      },
      {
        path: 'share',
        name: 'mobileShare',
        component: Share
      },
      {
        path: 'SimpleBio',
        name: 'mobileSimpleBio',
        component: SimpleBio
      },
      {
        path: 'aiAssistant',
        name: 'mobileAiAssistant',
        component: AiAssistant
      },
      {
        path: 'myAlbum',
        name: 'mobileMyAlbum',
        component: MyAlbum
      },
      {
        path: 'status',
        name: 'mobileStatusSettings',
        component: StatusSettings
      },
      {
        path: MOBILE_SETTINGS_RELATIVE_PATHS.securityPrivacy,
        name: MOBILE_SETTINGS_ROUTE_NAMES.securityPrivacy,
        component: SecuritySettings
      },
      {
        path: MOBILE_SETTINGS_RELATIVE_PATHS.legacySecurity,
        redirect: MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
      },
      {
        path: 'devices',
        name: 'mobileDeviceManagement',
        component: DeviceManagement
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
        path: MOBILE_SETTINGS_RELATIVE_PATHS.legacyHelp,
        redirect: MOBILE_SETTINGS_HELP_ABOUT_PATH
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
        path: MOBILE_SETTINGS_RELATIVE_PATHS.legacyIntegrations,
        redirect: MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH
      },
      {
        path: 'homeserver',
        name: 'mobileHomeserverSettings',
        component: HomeserverSettings
      },
      {
        path: 'favorites',
        name: 'mobileFavorites',
        component: Favorites
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
        path: 'mjolnir',
        name: 'mobileMjolnirSettings',
        component: MjolnirSettings
      },
      {
        path: 'preferences',
        name: 'mobilePreferencesSettings',
        component: PreferencesSettings
      }
    ]
  },
  {
    path: '/mobile/mobileFriends',
    name: 'mobileFriendsLayout',
    component: FriendsLayout,
    children: [
      {
        path: '',
        name: 'mobileFriendsDefault',
        redirect: '/mobile/mobileFriends/addFriends'
      },
      {
        path: 'addFriends',
        name: 'mobileAddFriends',
        component: AddFriends
      },
      {
        path: 'startGroupChat',
        name: 'mobileStartGroupChat',
        component: StartGroupChat
      },
      {
        path: 'confirmAddFriend',
        name: 'mobileConfirmAddFriend',
        component: ConfirmAddFriend
      },
      {
        path: 'confirmAddGroup',
        name: 'mobileConfirmAddGroup',
        component: ConfirmAddGroup
      },
      {
        path: 'friendInfo/:uid',
        name: 'mobileFriendInfo',
        component: FriendInfo
      }
    ]
  },
  {
    path: '/mobile/confirmQRLogin/:ip/:expireTime/:deviceType/:locPlace/:qrId',
    name: 'mobileConfirmQRLogin',
    component: ConfirmQRLogin,
    props: true
  },
  {
    path: '/mobile/myQRCode',
    name: 'mobileMyQRCode',
    component: FriendsLayout,
    children: [
      {
        path: '',
        name: 'mobileMyQRCodePage',
        component: MyQRCode
      }
    ]
  },
  {
    path: '/mobile/rtcCall',
    name: 'rtcCall',
    component: () => import('../../mobile/views/rtcCall/index.vue')
  },
  {
    path: '/mobile/admin',
    name: 'mobileAdmin',
    component: () => import('../../mobile/layout/index.vue'),
    children: [
      {
        path: '',
        name: 'mobileAdminHome',
        component: () => import('../../mobile/views/admin/AdminHome.vue')
      },
      {
        path: 'users',
        name: 'mobileAdminUsers',
        component: () => import('../../mobile/views/admin/AdminUsers.vue')
      },
      {
        path: 'rooms',
        name: 'mobileAdminRooms',
        component: () => import('../../mobile/views/admin/AdminRooms.vue')
      },
      {
        path: 'federation',
        name: 'mobileAdminFederation',
        component: () => import('../../mobile/views/admin/AdminFederation.vue')
      },
      {
        path: 'notices',
        name: 'mobileAdminNotices',
        component: () => import('../../mobile/views/admin/AdminNotices.vue')
      },
      {
        path: 'audit',
        name: 'mobileAdminAudit',
        component: () => import('../../mobile/views/admin/AdminAudit.vue')
      },
      {
        path: 'retention',
        name: 'mobileAdminRetention',
        component: () => import('../../mobile/views/admin/AdminRetention.vue')
      },
      {
        path: 'registration-tokens',
        name: 'mobileAdminRegistrationTokens',
        component: () => import('../../mobile/views/admin/AdminRegistrationTokens.vue')
      },
      {
        path: 'maintenance',
        name: 'mobileAdminMaintenance',
        component: () => import('../../mobile/views/admin/AdminMaintenance.vue')
      },
      {
        path: 'saml',
        name: 'mobileAdminSaml',
        component: () => import('../../mobile/views/admin/AdminSaml.vue')
      },
      {
        path: 'security',
        name: 'mobileAdminSecurity',
        component: () => import('../../mobile/views/admin/AdminSecurity.vue')
      },
      {
        path: 'server-logs',
        name: 'mobileAdminServerLogs',
        component: () => import('../../mobile/views/admin/AdminServerLogs.vue')
      }
    ]
  },
  {
    path: '/mobile/encryption',
    name: 'mobileEncryption',
    component: () => import('../../mobile/views/my/EncryptionSettings.vue')
  },
  {
    path: '/mobile/space',
    name: 'mobileSpaceView',
    component: () => import('../../mobile/views/space/SpaceView.vue')
  },
  {
    path: '/mobile/addGroupQRCode',
    name: 'mobileAddGroupQRCode',
    component: () => import('../../mobile/views/AddGroupQRCode.vue')
  }
]
