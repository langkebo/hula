import type { RouteRecordRaw } from 'vue-router'
import { CallTypeEnum } from '@/enums'
import { MOBILE_MY_SETTINGS_CHILD_ROUTES } from './mobileMySettingsRoutes'

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
const FriendGroups = () => import('#/views/friends/FriendGroups.vue')
const MobileMessagePage = () => import('#/views/message/index.vue')
const MobileSecretChatPage = () => import('#/views/secretChat/SecretChatPage.vue')

const EditBio = () => import('#/views/my/EditBio.vue')
const EditBirthday = () => import('#/views/my/EditBirthday.vue')
const EditProfile = () => import('#/views/my/EditProfile.vue')
const MobileMy = () => import('#/views/my/index.vue')
const MobileQRCode = () => import('#/views/my/MobileQRCode.vue')
const MobileSettings = () => import('#/views/my/MobileSettings.vue')
const MyMessages = () => import('#/views/my/MyMessages.vue')
const Share = () => import('#/views/my/Share.vue')
const MyAlbum = () => import('#/views/my/MyAlbum.vue')
const StatusSettings = () => import('#/views/my/StatusSettings.vue')
const ConfirmQRLogin = () => import('#/views/ConfirmQRLogin.vue')
const MyQRCode = () => import('#/views/MyQRCode.vue')
const Splashscreen = () => import('#/views/Splashscreen.vue')
const MobileForgetPassword = () => import('#/views/MobileForgetPassword.vue')
const MobileServiceAgreement = () => import('#/views/MobileServiceAgreement.vue')
const MobilePrivacyAgreement = () => import('#/views/MobilePrivacyAgreement.vue')
const SyncData = () => import('#/views/SyncData.vue')

/**
 * `/mobile/rtcCall` 的入参契约：调用方（`More.vue`、`RtcCallFloatCell.vue`）只把
 * `remoteUserId` / `roomId` / `callType` / `isIncoming` 放在 query 上，而通话页按 props 渲染。
 * 必须在路由层完成映射，否则 `isVideo` / `isIncoming` 恒为 false、`remoteUser` 为空。
 */
export const mapMobileRtcCallProps = (query: Record<string, unknown>) => {
  const read = (key: string): string => {
    const raw = query[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value === null || value === undefined) return ''
    return String(value)
  }
  const remoteUserId = read('remoteUserId')

  return {
    callId: read('callId'),
    roomId: read('roomId'),
    isVideo: read('callType') === String(CallTypeEnum.VIDEO),
    isIncoming: read('isIncoming') === 'true',
    remoteUser: remoteUserId ? { userId: remoteUserId } : undefined
  }
}

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
    // 私密会话列表：私密房会被普通会话列表整体过滤，必须有独立入口才进得去
    path: '/mobile/secretChat',
    name: 'mobileSecretChat',
    component: MobileSecretChatPage
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
        path: 'chatMain/:roomId?', // 参数是房间号（群聊无对端 uid）；旧链接带 uid 时页面反查兜底
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
        path: 'manageGroupMember',
        name: 'manageGroupMember',
        component: () => import('@/mobile/views/chat-room/ManageGroupMember.vue')
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
        component: MobileMessagePage,
        meta: { keepAlive: true }
      },
      {
        path: '/mobile/friends',
        name: 'mobileFriends',
        component: MobileFriendPage,
        meta: { keepAlive: true }
      },
      {
        path: '/mobile/my',
        name: 'mobileMy',
        component: MobileMy,
        meta: { keepAlive: true }
      },
      {
        path: '/mobile/rooms',
        name: 'mobileRooms',
        component: () => import('#/views/rooms/index.vue'),
        meta: { keepAlive: true }
      },
      {
        // 空间页作为主导航 Tab 之一，必须置于 /mobile/home 壳层内，
        // 才能与消息/好友/房间/我的共享底部 TabBar（原型移动端 5 Tab 同壳）。
        path: '/mobile/space',
        name: 'mobileSpaceView',
        component: () => import('../../mobile/views/space/SpaceView.vue'),
        meta: { keepAlive: true }
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
        path: 'myQRCode',
        name: 'mobileMyQRCodePage',
        component: MyQRCode
      },
      {
        path: 'share',
        name: 'mobileShare',
        component: Share
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
      ...MOBILE_MY_SETTINGS_CHILD_ROUTES
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
        path: 'groups',
        name: 'mobileFriendGroups',
        component: FriendGroups
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
    // MSC4108 QR login confirmation — existing device (mobile) scans the QR
    // code generated by the new device (desktop) and confirms the login.
    // The QR data (base64) is passed via the `qr_data` query param.
    path: '/mobile/confirmQRLogin',
    name: 'mobileConfirmQRLogin',
    component: ConfirmQRLogin,
    props: (route) => ({ qrData: route.query.qr_data as string })
  },
  {
    path: '/mobile/rtcCall',
    name: 'rtcCall',
    component: () => import('../../mobile/views/rtcCall/index.vue'),
    props: (route) => mapMobileRtcCallProps(route.query as Record<string, unknown>)
  },
  {
    path: '/mobile/addGroupQRCode',
    name: 'mobileAddGroupQRCode',
    component: () => import('../../mobile/views/AddGroupQRCode.vue')
  }
]
