import { useI18n } from 'vue-i18n'
import { MittEnum, ModalEnum, PluginEnum } from '@/enums'
import { useLoginFlow } from '@/hooks/useLoginFlow'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import { matrixCapabilityService } from '@/services/matrix/MatrixCapabilityService'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LeftConfig')

/**
 * 这里的顶部的操作栏使用pinia写入了localstorage中
 */
/** 下半部分操作栏配置 */
const baseItemsBottom: Array<Omit<OPT.L.Common, 'title' | 'shortTitle'>> = [
  {
    url: 'fileManager',
    icon: 'file',
    iconAction: 'file-action',
    size: {
      width: 840,
      height: 600
    },
    window: {
      resizable: false
    }
  },
  {
    url: 'mail',
    icon: 'collect',
    iconAction: 'collect-action',
    size: {
      width: 840,
      height: 600
    },
    window: {
      resizable: true
    }
  }
]

const useItemsBottom = () =>
  (() => {
    const { t } = useI18n()
    return computed<OPT.L.Common[]>(() => [
      {
        ...baseItemsBottom[0],
        title: t('home.action.file_manager'),
        shortTitle: t('home.action.file_manager_short_title')
      },
      {
        ...baseItemsBottom[1],
        title: t('home.action.favorite'),
        shortTitle: t('home.action.favorite_short_title')
      }
    ])
  })()
/** 设置列表菜单项 */
const useMoreList = () => {
  const { t } = useI18n()
  const { createWebviewWindow } = useWindow()
  const { logout } = useLoginFlow()
  const showHomeserverDialog = ref(false)

  const openHomeserverDialog = () => {
    showHomeserverDialog.value = true
  }

  const handleHomeserverSave = (endpoint: { homeserverUrl: string; identityServerUrl: string }) => {
    logger.debug('Homeserver saved:', endpoint)
  }

  return {
    showHomeserverDialog,
    openHomeserverDialog,
    handleHomeserverSave,
    moreList: computed<OPT.L.MoreList[]>(() => {
      const adminStore = useAdminStore()
      const hasAdminApi = matrixCapabilityService.hasCapability('admin-api')
      const items: OPT.L.MoreList[] = [
        {
          label: t('menu.homeserver'),
          icon: 'server',
          click: openHomeserverDialog
        }
      ]

      if (hasAdminApi && adminStore.canAccessAdmin) {
        items.push({
          label: t('menu.admin_panel'),
          icon: 'shield',
          click: async () => {
            const { useRouter } = await import('vue-router')
            const router = useRouter()
            router.push('/admin')
          }
        })
      }

      items.push(
        {
          label: t('menu.check_update'),
          icon: 'arrow-circle-up',
          click: () => {
            useMitt.emit(MittEnum.LEFT_MODAL_SHOW, {
              type: ModalEnum.CHECK_UPDATE
            })
          }
        },
        {
          label: t('menu.lock_screen'),
          icon: 'lock',
          click: () => {
            useMitt.emit(MittEnum.LEFT_MODAL_SHOW, {
              type: ModalEnum.LOCK_SCREEN
            })
          }
        },
        {
          label: t('menu.settings'),
          icon: 'settings',
          click: async () => {
            await createWebviewWindow('设置', 'settings', 840, 840, '', true, 840, 600)
          }
        },
        {
          label: t('menu.about'),
          icon: 'info',
          click: async () => {
            await createWebviewWindow('关于', 'about', 360, 480)
          }
        },
        {
          label: t('menu.sign_out'),
          icon: 'power',
          click: async () => {
            try {
              await logout()
            } catch (error) {
              logger.error('退出登录失败:', error)
              window.$message.error('退出登录失败，请重试')
            }
          }
        }
      )

      return items
    })
  }
}

/** 插件列表 */
const basePluginsList: Array<Omit<STO.Plugins<PluginEnum>, 'title' | 'shortTitle'>> = [
  {
    url: 'roomList',
    icon: 'view-grid-card',
    iconAction: 'view-grid-card',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    miniShow: false
  },
  {
    url: 'space',
    icon: 'peoples-two',
    iconAction: 'peoples-two',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    miniShow: false
  },
  {
    icon: 'robot',
    iconAction: 'GPT',
    url: 'robot',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    size: {
      minWidth: 1240,
      width: 1380,
      height: 800
    },
    window: {
      resizable: true
    },
    miniShow: false
  }
  // {
  //   icon: 'Music',
  //   url: 'music',
  //   title: 'HuLa云音乐',
  //   shortTitle: '云音乐',
  //   tip: 'HuLa云音乐开发中，敬请期待',
  //   state: PluginEnum.NOT_INSTALLED,
  //   version: 'v1.0.0-Alpha',
  //   isAdd: false,
  //   dot: true,
  //   progress: 0,
  //   size: {
  //     minWidth: 780,
  //     width: 980,
  //     height: 800
  //   },
  //   window: {
  //     resizable: true
  //   },
  //   miniShow: false
  // },
  // {
  //   icon: 'UimSlack',
  //   url: 'collaboration',
  //   title: 'HuLa协作',
  //   shortTitle: '协作',
  //   tip: 'HuLa协作开发中，敬请期待',
  //   state: PluginEnum.NOT_INSTALLED,
  //   version: 'v1.0.0-Alpha',
  //   isAdd: false,
  //   dot: true,
  //   progress: 0,
  //   size: {
  //     minWidth: 780,
  //     width: 980,
  //     height: 800
  //   },
  //   window: {
  //     resizable: true
  //   },
  //   miniShow: false
  // },
  // {
  //   icon: 'vigo',
  //   url: 'collaboration',
  //   title: 'HuLa短视频',
  //   shortTitle: '短视频',
  //   tip: 'HuLa短视频开发中，敬请期待',
  //   state: PluginEnum.NOT_INSTALLED,
  //   version: 'v1.0.0-Alpha',
  //   isAdd: false,
  //   dot: true,
  //   progress: 0,
  //   size: {
  //     minWidth: 780,
  //     width: 980,
  //     height: 800
  //   },
  //   window: {
  //     resizable: true
  //   },
  //   miniShow: false
  // }
]

const usePluginsList = () =>
  (() => {
    const { t } = useI18n()
    return computed<STO.Plugins<PluginEnum>[]>(() => [
      {
        ...basePluginsList[0],
        title: t('home.plugins.room_list'),
        shortTitle: t('home.plugins.room_list_short_title')
      },
      {
        ...basePluginsList[1],
        title: t('home.plugins.space_list'),
        shortTitle: t('home.plugins.space_list_short_title')
      },
      {
        ...basePluginsList[2],
        title: t('home.plugins.chatbot'),
        shortTitle: t('home.plugins.chatbot_short_title')
      }
    ])
  })()

export { useItemsBottom, useMoreList, usePluginsList }
