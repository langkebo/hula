import type { RouteRecordRaw } from 'vue-router'

const FriendsList = () => import('@/views/homeWindow/FriendsList.vue')
const Message = () => import('@/views/homeWindow/message/index.vue')
const SearchDetails = () => import('@/views/homeWindow/SearchDetails.vue')

export const getDesktopRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/home',
    name: 'home',
    component: () => import('@/layout/index.vue'),
    children: [
      {
        path: '/message',
        name: 'message',
        component: Message
      },
      {
        path: '/friendsList',
        name: 'friendsList',
        component: FriendsList
      },
      {
        path: '/searchDetails',
        name: 'searchDetails',
        component: SearchDetails
      }
    ]
  },
  {
    path: '/robot',
    name: 'robot',
    component: () => import('@/plugins/robot/index.vue'),
    children: [
      {
        path: '/chat',
        name: 'chat',
        component: () => import('@/plugins/robot/views/Chat.vue')
      }
    ]
  },
  {
    path: '/trendradar',
    name: 'trendradar',
    component: () => import('@/views/trendradar/TrendRadarView.vue')
  },
  {
    path: '/openclaw',
    name: 'openclaw',
    component: () => import('@/views/openclaw/OpenClawView.vue')
  },
  {
    path: '/mail',
    name: 'mail',
    component: () => import('@/views/mailWindow/index.vue')
  },
  {
    path: '/fileManager',
    name: 'fileManager',
    component: () => import('@/views/fileManagerWindow/index.vue')
  },
  {
    path: '/dynamic',
    name: 'dynamic',
    component: () => import('@/plugins/dynamic/index.vue')
  },
  {
    path: '/dynamic/:id',
    name: 'dynamicDetailWithId',
    component: () => import('@/plugins/dynamic/detail.vue')
  },
  {
    path: '/dynamicDetail',
    name: 'dynamicDetail',
    component: () => import('@/plugins/dynamic/detail.vue')
  },
  {
    path: '/onlineStatus',
    name: 'onlineStatus',
    component: () => import('@/views/onlineStatusWindow/index.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/aboutWindow/index.vue')
  },
  {
    path: '/alone',
    name: 'alone',
    component: () => import('@/views/homeWindow/message/Alone.vue')
  },
  {
    path: '/sharedScreen',
    name: 'sharedScreen',
    component: () => import('@/views/homeWindow/SharedScreen.vue')
  },
  {
    path: '/modal-invite',
    name: 'modal-invite',
    component: () => import('@/views/modalWindow/index.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/moreWindow/settings/index.vue'),
    children: [
      {
        path: '/general',
        name: 'general',
        component: () => import('@/views/moreWindow/settings/General.vue')
      },
      {
        path: '/loginSetting',
        name: 'loginSetting',
        component: () => import('@/views/moreWindow/settings/LoginSetting.vue')
      },
      {
        path: '/notification',
        name: 'notification',
        component: () => import('@/views/moreWindow/settings/Notification.vue')
      },
      {
        path: '/versatile',
        name: 'versatile',
        component: () => import('@/views/moreWindow/settings/Versatile.vue')
      },
      {
        path: '/manageStore',
        name: 'manageStore',
        component: () => import('@/views/moreWindow/settings/ManageStore.vue')
      },
      {
        path: '/shortcut',
        name: 'shortcut',
        component: () => import('@/views/moreWindow/settings/Shortcut.vue')
      },
      {
        path: '/privateChat',
        name: 'privateChat',
        component: () => import('@/views/moreWindow/settings/PrivateChat.vue')
      },
      {
        path: '/account',
        name: 'account',
        component: () => import('@/views/moreWindow/settings/Account.vue')
      },
      {
        path: '/sessions',
        name: 'sessions',
        component: () => import('@/views/moreWindow/settings/Sessions.vue')
      },
      {
        path: '/appearance',
        name: 'appearance',
        component: () => import('@/views/moreWindow/settings/Appearance.vue')
      },
      {
        path: '/sidebar',
        name: 'sidebar',
        component: () => import('@/views/moreWindow/settings/Sidebar.vue')
      },
      {
        path: '/voiceVideo',
        name: 'voiceVideo',
        component: () => import('@/views/moreWindow/settings/VoiceVideo.vue')
      },
      {
        path: '/securityPrivacy',
        name: 'securityPrivacy',
        component: () => import('@/views/moreWindow/settings/SecurityPrivacy.vue')
      },
      {
        path: '/helpAbout',
        name: 'helpAbout',
        component: () => import('@/views/moreWindow/settings/HelpAbout.vue')
      },
      {
        path: '/encryption',
        name: 'encryption',
        component: () => import('@/views/moreWindow/settings/Encryption.vue')
      },
      {
        path: '/threepid',
        name: 'threepid',
        component: () => import('@/views/moreWindow/settings/ThreePidSettings.vue')
      }
    ]
  },
  {
    path: '/announList/:roomId/:type',
    name: 'announList',
    component: () => import('@/views/announWindow/index.vue')
  },
  {
    path: '/previewFile',
    name: 'previewFile',
    component: () => import('@/views/previewFileWindow/index.vue')
  },
  {
    path: '/chat-history',
    name: 'chat-history',
    component: () => import('@/views/chatHistory/index.vue')
  },
  {
    path: '/secretChat',
    name: 'secretChat',
    component: () => import('@/views/homeWindow/SecretChatPage.vue')
  },
  {
    path: '/rtcCall',
    name: 'rtcCall',
    component: () => import('@/views/callWindow/index.vue')
  },
  {
    path: '/multiMsg',
    name: 'multiMsg',
    component: () => import('@/views/multiMsgWindow/index.vue')
  },
  {
    path: '/searchFriend',
    name: 'searchFriend',
    component: () => import('@/views/friendWindow/SearchFriend.vue')
  },
  {
    path: '/addFriendVerify',
    name: 'addFriendVerify',
    component: () => import('@/views/friendWindow/AddFriendVerify.vue')
  },
  {
    path: '/addGroupVerify',
    name: 'addGroupVerify',
    component: () => import('@/views/friendWindow/AddGroupVerify.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'adminDefault',
        redirect: '/admin/dashboard'
      },
      {
        path: 'dashboard',
        name: 'adminDashboard',
        component: () => import('@/views/admin/AdminDashboard.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'users',
        name: 'adminUsers',
        component: () => import('@/views/admin/AdminUsers.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'rooms',
        name: 'adminRooms',
        component: () => import('@/views/admin/AdminRooms.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'federation',
        name: 'adminFederation',
        component: () => import('@/views/admin/AdminFederation.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'notices',
        name: 'adminNotices',
        component: () => import('@/views/admin/AdminNotices.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'registration-tokens',
        name: 'adminRegistrationTokens',
        component: () => import('@/views/admin/AdminRegistrationTokens.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'security',
        name: 'adminSecurity',
        component: () => import('@/views/admin/AdminSecurity.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'audit',
        name: 'adminAudit',
        component: () => import('@/views/admin/AdminAudit.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'retention',
        name: 'adminRetention',
        component: () => import('@/views/admin/AdminRetention.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'server-logs',
        name: 'adminServerLogs',
        component: () => import('@/views/admin/AdminServerLogs.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'federation-monitor',
        name: 'adminFederationMonitor',
        component: () => import('@/views/admin/AdminFederationMonitor.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'saml',
        name: 'adminSaml',
        component: () => import('@/views/admin/AdminSaml.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'maintenance',
        name: 'adminMaintenance',
        component: () => import('@/views/admin/AdminMaintenance.vue'),
        meta: { requiresAdmin: true }
      }
    ]
  }
]
