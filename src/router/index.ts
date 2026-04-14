import { invoke } from '@tauri-apps/api/core'
import { type } from '@tauri-apps/plugin-os'
import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
  type RouteRecordRaw
} from 'vue-router'

import FriendsList from '@/views/homeWindow/FriendsList.vue'
import Message from '@/views/homeWindow/message/index.vue'
import { TauriCommand } from '@/enums'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RouterGuard')

// Mobile views are imported dynamically below to implement lazy loading
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
const ConfirmAddGroup = () => import('#/views/friends/ConfirmAddGroup.vue')
const ConfirmAddFriend = () => import('#/views/friends/ConfirmAddFriend.vue')
const AddFriends = () => import('#/views/friends/AddFriends.vue')
const FriendInfo = () => import('#/views/friends/FriendInfo.vue')
const MobileFriendPage = () => import('#/views/friends/index.vue')
const StartGroupChat = () => import('#/views/friends/StartGroupChat.vue')
const MobileMessagePage = () => import('#/views/message/index.vue')
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
const IgnoredUsers = () => import('#/views/my/IgnoredUsers.vue')
const LoginHistory = () => import('#/views/my/LoginHistory.vue')
const ThreePidManagement = () => import('#/mobile/views/my/ThreePidManagement.vue')
const Favorites = () => import('#/views/my/Favorites.vue')
const Files = () => import('#/views/my/Files.vue')
const OpenClawChat = () => import('#/views/my/OpenClawChat.vue')
const MobileRoomList = () => import('#/views/room/index.vue')
const ConfirmQRLogin = () => import('#/views/ConfirmQRLogin.vue')
const MyQRCode = () => import('#/views/MyQRCode.vue')
const Splashscreen = () => import('#/views/Splashscreen.vue')
const MobileForgetPassword = () => import('#/views/MobileForgetPassword.vue')
const MobileServiceAgreement = () => import('#/views/MobileServiceAgreement.vue')
const MobilePrivacyAgreement = () => import('#/views/MobilePrivacyAgreement.vue')
const SyncData = () => import('#/views/SyncData.vue')

/**! 创建窗口后再跳转页面就会导致样式没有生效所以不能使用懒加载路由的方式，有些页面需要快速响应的就不需要懒加载 */
const { BASE_URL } = import.meta.env

const isMobile = type() === 'ios' || type() === 'android'

// 移动端路由配置 - 使用直接导入避免懒加载问题
const getMobileRoutes = (): Array<RouteRecordRaw> => [
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
        path: 'chatMain/:uid?', // 可选传入，如果传入uid就表示房间属于好友的私聊房间
        name: 'mobileChatMain',
        component: MobileChatMain,
        props: true,
        meta: { keepAlive: true }
      },
      {
        path: 'spaceDetail/:roomId',
        name: 'mobileSpaceDetail',
        component: () => import('@/mobile/views/room/SpaceDetail.vue')
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
        path: '/mobile/rooms',
        name: 'mobileRooms',
        component: MobileRoomList
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
        path: 'security',
        name: 'mobileSecuritySettings',
        component: SecuritySettings
      },
      {
        path: 'devices',
        name: 'mobileDeviceManagement',
        component: DeviceManagement
      },
      {
        path: 'keyBackup',
        name: 'mobileKeyBackup',
        component: () => import('@/mobile/views/my/MobileKeyBackup.vue')
      },
      {
        path: 'ignoredUsers',
        name: 'mobileIgnoredUsers',
        component: IgnoredUsers
      },
      {
        path: 'loginHistory',
        name: 'mobileLoginHistory',
        component: LoginHistory
      },
      {
        path: 'threePid',
        name: 'mobileThreePid',
        component: ThreePidManagement
      },
      {
        path: 'openclaw',
        name: 'mobileOpenClawChat',
        component: OpenClawChat
      },
      {
        path: 'notifications',
        name: 'mobileNotificationSettings',
        component: NotificationSettings
      },
      {
        path: 'help',
        name: 'mobileHelpFeedback',
        component: HelpFeedback
      },
      {
        path: 'voiceVideo',
        name: 'mobileVoiceVideoSettings',
        component: VoiceVideoSettings
      },
      {
        path: 'labs',
        name: 'mobileLabsSettings',
        component: LabsSettings
      },
      {
        path: 'integrations',
        name: 'mobileIntegrationsSettings',
        component: IntegrationsSettings
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
    component: () => import('../mobile/views/rtcCall/index.vue')
  }
]

const getDesktopRoutes = (): Array<RouteRecordRaw> => [
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
        path: '/roomList',
        name: 'roomList',
        component: () => import('@/views/homeWindow/RoomList.vue')
      },
      {
        path: '/spaceList',
        name: 'spaceList',
        component: () => import('@/views/homeWindow/SpaceList.vue')
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
    path: '/space',
    name: 'space',
    component: () => import('@/views/spaceWindow/index.vue')
  },
  {
    path: '/space/:roomId',
    name: 'spaceDetail',
    component: () => import('@/views/spaceWindow/SpaceDetail.vue')
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
  // 添加聊天记录窗口路由
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
  }
]

// Desktop views
const SearchDetails = () => import('@/views/homeWindow/SearchDetails.vue')

// 通用路由配置（所有平台都需要）
const getCommonRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/manageGroupMember',
    name: 'manageGroupMember',
    component: () => import('@/views/ManageGroupMember.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/loginWindow/Login.vue')
  },
  {
    path: '/splashscreen',
    name: 'splashscreen',
    component: Splashscreen
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/registerWindow/index.vue')
  },
  {
    path: '/forgetPassword',
    name: 'forgetPassword',
    component: () => import('@/views/forgetPasswordWindow/index.vue')
  },
  {
    path: '/qrCode',
    name: 'qrCode',
    component: () => import('@/views/loginWindow/QRCode.vue')
  },
  {
    path: '/network',
    name: 'network',
    component: () => import('@/views/loginWindow/Network.vue')
  },
  {
    path: '/tray',
    name: 'tray',
    component: () => import('@/views/Tray.vue')
  },
  {
    path: '/notify',
    name: 'notify',
    component: () => import('@/views/Notify.vue')
  },
  {
    path: '/update',
    name: 'update',
    component: () => import('@/views/Update.vue')
  },
  {
    path: '/checkupdate',
    name: 'checkupdate',
    component: () => import('@/views/CheckUpdate.vue')
  },
  {
    path: '/capture',
    name: 'capture',
    component: () => import('@/views/Capture.vue')
  },
  {
    path: '/imageViewer',
    name: 'imageViewer',
    component: () => import('@/views/imageViewerWindow/index.vue')
  },
  {
    path: '/videoViewer',
    name: 'videoViewer',
    component: () => import('@/views/videoViewerWindow/index.vue')
  },
  {
    path: '/modal-serviceAgreement',
    name: 'modal-serviceAgreement',
    component: () => import('@/views/agreementWindow/Server.vue')
  },
  {
    path: '/modal-privacyAgreement',
    name: 'modal-privacyAgreement',
    component: () => import('@/views/agreementWindow/Privacy.vue')
  },
  {
    path: '/modal-secretChat',
    name: 'modal-secretChat',
    component: () => import('@/views/loginWindow/SecretChatModal.vue')
  },
  {
    path: '/oidc/callback',
    name: 'oidcCallback',
    component: () => import('@/views/loginWindow/OidcCallback.vue')
  }
]

// 创建所有路由（通用路由 + 平台特定路由）
const getAllRoutes = (): Array<RouteRecordRaw> => {
  const commonRoutes = getCommonRoutes()
  if (isMobile) {
    return [...commonRoutes, ...getMobileRoutes()]
  } else {
    return [...commonRoutes, ...getDesktopRoutes()]
  }
}

// 创建路由
const router: any = createRouter({
  history: createWebHistory(BASE_URL),
  routes: getAllRoutes()
})

// 在创建路由后，添加全局前置守卫
router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
  // 设置页面标题
  const title = to.meta.title as string | undefined
  if (title) {
    document.title = `${title} - HuLa`
  }

  // 白名单路由：不需要认证的页面
  const publicRoutes = [
    '/login',
    '/register',
    '/forgetPassword',
    '/mobile/login',
    '/mobile/splashscreen',
    '/mobile/MobileForgetPassword',
    '/mobile/serviceAgreement',
    '/mobile/privacyAgreement',
    '/oidcCallback'
  ]

  // 检查是否是白名单路由
  const isPublicRoute = publicRoutes.some((route) => to.path === route || to.path.startsWith(route + '/'))

  if (isPublicRoute) {
    return next()
  }

  try {
    // 获取用户 tokens
    const tokens = await invoke<{ token: string | null; refreshToken: string | null }>(TauriCommand.GET_USER_TOKENS)
    const isLoggedIn = !!(tokens.token && tokens.refreshToken)

    if (!isLoggedIn) {
      const loginPath = isMobile ? '/mobile/login' : '/login'
      logger.warn(`未登录，跳转到 ${loginPath}`)
      return next(loginPath)
    }

    // 检查权限（如果路由需要特定权限）
    const requiredPermission = to.meta.permission as string | undefined
    if (requiredPermission) {
      // 这里可以添加权限检查逻辑
      // const userStore = useUserStore()
      // if (!userStore.hasPermission(requiredPermission)) {
      //   return next('/403')
      // }
    }

    return next()
  } catch (err) {
    logger.error('认证检查错误:', err)
    const loginPath = isMobile ? '/mobile/login' : '/login'
    if (to.path !== loginPath) {
      return next(loginPath)
    }
    return next()
  }
})

export default router
