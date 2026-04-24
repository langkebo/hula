import type { RouteRecordRaw } from 'vue-router'

const Splashscreen = () => import('#/views/Splashscreen.vue')

export const getCommonRoutes = (): Array<RouteRecordRaw> => [
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
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/admin/Forbidden.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: () => import('@/views/NotFound.vue')
  }
]
