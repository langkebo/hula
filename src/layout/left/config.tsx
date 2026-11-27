import { useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useWindow } from '@/composables/common/useWindow'
import { MittEnum, ModalEnum, PluginEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { useLoginFlow } from '@/shared/composables/useLoginFlow'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { createLogger } from '@/utils/Logger'
import { modalShow } from './model'

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
  }
]

const useItemsBottom = () =>
  (() => {
    const { t } = useI18nGlobal()
    return computed<OPT.L.Common[]>(() => [
      {
        ...baseItemsBottom[0],
        title: t('home.action.file_manager'),
        shortTitle: t('home.action.file_manager_short_title')
      }
    ])
  })()
/** 设置列表菜单项 */
const useMoreList = () => {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const { createWebviewWindow } = useWindow()
  const { logout } = useLoginFlow()
  const router = useRouter()
  const showHomeserverDialog = ref(false)

  const openHomeserverDialog = () => {
    showHomeserverDialog.value = true
  }

  return {
    showHomeserverDialog,
    openHomeserverDialog,
    moreList: computed<OPT.L.MoreList[]>(() => {
      const adminStore = useAdminStore()
      const items: OPT.L.MoreList[] = [
        {
          label: t('menu.homeserver'),
          icon: 'server',
          click: openHomeserverDialog
        }
      ]

      if (adminStore.canShowAdminEntry) {
        items.push({
          label: t('admin.panel'),
          icon: 'wrench',
          click: () => {
            router.push('/admin')
          }
        })
      }

      items.push(
        {
          label: t('menu.check_update'),
          icon: 'arrow-circle-up',
          click: () => {
            // 本版本未配置更新源，如实告知，避免调用必然失败的 updater.check()
            showFeedback(t('message.check_update.not_configured'), 'info')
          }
        },
        {
          label: t('menu.lock_screen'),
          icon: 'lock',
          click: () => {
            // LEFT_MODAL_SHOW 只负责挂载 LockScreen 组件，弹窗可见性由 modalShow 控制；
            // 不置 true 会挂载一个隐藏的 NModal（P-04：点击「锁定屏幕」无任何界面）。
            modalShow.value = true
            useMitt.emit(MittEnum.LEFT_MODAL_SHOW, {
              type: ModalEnum.LOCK_SCREEN
            })
          }
        },
        {
          label: t('menu.settings'),
          icon: 'settings',
          click: async () => {
            // 设置已内嵌为应用内视图，直接路由跳转（不再创建独立窗口）
            await router.push('/settings')
          }
        },
        {
          label: t('menu.about'),
          icon: 'info',
          click: async () => {
            await createWebviewWindow(t('common.window_titles.about'), 'about', 360, 480)
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
              showFeedback(t('menu.sign_out_failed'), 'error')
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
    icon: 'room',
    iconAction: 'room',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    miniShow: false
  },
  {
    url: 'space',
    icon: 'space',
    iconAction: 'space',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    miniShow: false
  },
  {
    url: 'federation',
    icon: 'federation',
    iconAction: 'federation',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    miniShow: false
  }
]

const usePluginsList = () =>
  (() => {
    const { t } = useI18nGlobal()
    return computed<STO.Plugins<PluginEnum>[]>(() => {
      const plugins: STO.Plugins<PluginEnum>[] = [
        {
          ...basePluginsList[0],
          title: t('home.plugins.room_list'),
          shortTitle: t('home.plugins.room_list_short_title')
        },
        {
          ...basePluginsList[1],
          title: t('home.plugins.space_list'),
          shortTitle: t('home.plugins.space_list_short_title')
        }
      ]

      // 联邦页仅管理员可见，普通用户不出现入口
      if (useAdminStore().canShowAdminEntry) {
        plugins.push({
          ...basePluginsList[2],
          title: t('home.plugins.federation'),
          shortTitle: t('home.plugins.federation_short_title')
        })
      }

      return plugins
    })
  })()

export { useItemsBottom, useMoreList, usePluginsList }
