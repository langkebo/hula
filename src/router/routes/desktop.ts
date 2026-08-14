import type { RouteRecordRaw } from 'vue-router'

const FriendsList = () => import('@/views/homeWindow/FriendsList.vue')
const Message = () => import('@/views/homeWindow/message/index.vue')
const RoomList = () => import('@/views/homeWindow/RoomList.vue')
const SpaceList = () => import('@/views/homeWindow/SpaceList.vue')
const FederationView = () => import('@/views/homeWindow/FederationView.vue')
const SettingsWindow = () => import('@/views/settingsWindow/index.vue')

export const getDesktopRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/home',
    name: 'home',
    component: () => import('@/layout/index.vue'),
    children: [
      // /friend 系列 - 中间栏始终渲染 FriendsList，右侧栏根据子路由切换
      { path: '/friend', name: 'friend', component: FriendsList },
      { path: '/friend/add', name: 'friend-add', component: FriendsList },
      { path: '/friend/requests', name: 'friend-requests', component: FriendsList },
      { path: '/friend/:userId', name: 'friend-details', component: FriendsList },

      // /room 系列 - 中间栏始终渲染 RoomList
      { path: '/room', name: 'room', component: RoomList },
      { path: '/room/create', name: 'room-create', component: RoomList },
      { path: '/room/join', name: 'room-join', component: RoomList },
      { path: '/room/:roomId', name: 'room-details', component: RoomList },

      // /space 系列 - 中间栏始终渲染 SpaceList
      { path: '/space', name: 'space', component: SpaceList },
      { path: '/space/create', name: 'space-create', component: SpaceList },
      { path: '/space/:spaceId', name: 'space-details', component: SpaceList },

      // /federation - 联邦主视图
      { path: '/federation', name: 'federation', component: FederationView },

      // /message 系列 - 渲染消息列表，:roomId 可选
      { path: '/message/:roomId?', name: 'message', component: Message },

      // /search - 全局搜索（阶段 9 替换为独立 SearchView）
      { path: '/search', name: 'search', component: FriendsList },

      // 旧路径 redirect（向后兼容）
      { path: '/friendsList', redirect: '/friend' },
      { path: '/roomList', redirect: '/room' },
      { path: '/spaceList', redirect: '/space' }
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
    path: '/settings',
    name: 'settings',
    component: SettingsWindow
  },
  {
    path: '/general',
    redirect: '/settings?tab=preferences'
  },
  {
    path: '/loginSetting',
    redirect: '/settings?tab=preferences'
  },
  {
    path: '/manageStore',
    redirect: '/settings?tab=preferences'
  },
  {
    path: '/notification',
    redirect: '/settings?tab=notifications'
  },
  {
    path: '/shortcut',
    redirect: '/settings?tab=keyboard'
  },
  {
    path: '/privateChat',
    redirect: '/settings?tab=securityPrivacy'
  },
  {
    path: '/account',
    redirect: '/settings?tab=account'
  },
  {
    path: '/sessions',
    redirect: '/settings?tab=sessions'
  },
  {
    path: '/appearance',
    redirect: '/settings?tab=appearance'
  },
  {
    path: '/sidebar',
    redirect: '/settings?tab=sidebar'
  },
  {
    path: '/voiceVideo',
    redirect: '/settings?tab=voiceVideo'
  },
  {
    path: '/security-privacy',
    redirect: '/settings?tab=securityPrivacy'
  },
  {
    path: '/help-about',
    redirect: '/settings?tab=helpAbout'
  },
  {
    path: '/encryption',
    redirect: '/settings?tab=encryption'
  },
  {
    path: '/threepid',
    redirect: '/settings?tab=account'
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
  // 附录 C.5：独立聊天窗口路由，与主窗口路由隔离
  {
    path: '/window/chat/:roomId',
    name: 'windowChat',
    component: () => import('@/views/windowChat/index.vue')
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
      },
      {
        path: 'server-config',
        name: 'adminServerConfig',
        component: () => import('@/views/admin/AdminServerConfig.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'guests',
        name: 'adminGuests',
        component: () => import('@/views/admin/AdminGuests.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'spaces',
        name: 'adminSpaces',
        component: () => import('@/views/admin/AdminSpaces.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'notifications',
        name: 'adminNotifications',
        component: () => import('@/views/admin/AdminNotifications.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'app-services',
        name: 'adminAppServices',
        component: () => import('@/views/admin/AdminAppServices.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: 'moderation',
        name: 'adminModeration',
        component: () => import('@/views/admin/ModerationPanel.vue'),
        meta: { requiresAdmin: true }
      },
      {
        path: '/admin/modules',
        name: 'AdminModules',
        component: () => import('@/views/admin/AdminModules.vue'),
        meta: { title: '功能模块', requiresAdmin: true }
      }
    ]
  }
]
