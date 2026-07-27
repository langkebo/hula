import { useTimeoutFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useWindow } from '@/composables/common/useWindow'
import { IsYesEnum, MittEnum, ThemeEnum } from '@/enums'
import router from '@/router'
import { badgeService } from '@/services/BadgeService'
import { useI18nGlobal } from '@/services/i18n'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import type { BadgeType, UserInfoType } from '@/services/types.ts'
import { type MatrixRoomMember, useGroupStore } from '@/stores/domains/chat/group'
import { useMenuTopStore } from '@/stores/domains/settings/menuTop'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LeftHook')

export const leftHook = () => {
  const prefers = matchMedia('(prefers-color-scheme: dark)')
  const { createWebviewWindow } = useWindow()
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const settingStore = useSettingStore()
  const { menuTop } = storeToRefs(useMenuTopStore())
  const loginHistoriesStore = useLoginHistoriesStore()
  const userStore = useUserStore()
  const userStatusStore = useUserStatusStore()
  const { currentState } = storeToRefs(userStatusStore)
  const activeUrl = ref<string>(menuTop.value?.[0]?.url || 'message')
  const settingShow = ref(false)
  const shrinkStatus = ref(false)
  const groupStore = useGroupStore()
  /** 是否展示个人信息浮窗 */
  const infoShow = ref(false)
  /** 是否显示上半部分操作栏中的提示 */
  const tipShow = ref(true)
  const themeColor = ref(
    settingStore.themeContent === ThemeEnum.DARK ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)'
  )
  /** 已打开窗口的列表 */
  const openWindowsList = ref(new Set<string>())
  /** 编辑资料弹窗 */
  const editInfo = ref<{
    show: boolean
    content: Partial<UserInfoType>
    badgeList: BadgeType[]
  }>({
    show: false,
    content: {},
    badgeList: []
  })
  /** 当前用户佩戴的徽章  */
  const currentBadge = computed(() =>
    editInfo.value.badgeList.find((item) => item.obtain === IsYesEnum.YES && item.wearing === IsYesEnum.YES)
  )

  /* =================================== 方法 =============================================== */

  /** 跟随系统主题模式切换主题 */
  const followOS = () => {
    themeColor.value = prefers.matches ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)'
  }

  watchEffect(() => {
    /** 判断是否是跟随系统主题 */
    if (settingStore.themePattern === ThemeEnum.OS) {
      followOS()
      prefers.addEventListener('change', followOS)
    } else {
      prefers.removeEventListener('change', followOS)
    }
  })

  /** 更新缓存里面的用户信息 */
  const updateCurrentUserCache = (key: 'name' | 'avatar', value: string | null | undefined) => {
    const uid = userStore.userInfo?.uid
    if (!uid) return
    const currentUser = groupStore.getUserInfo(uid) as MatrixRoomMember | null
    if (currentUser) {
      if (value) {
        currentUser[key] = value
      }
    }
  }

  /** 保存用户信息 */
  const saveEditInfo = (localUserInfo: Partial<UserInfoType>) => {
    if (!localUserInfo.name || localUserInfo.name.trim() === '') {
      showFeedback(t('home.profile_edit.toast.nickname_empty'), 'error')
      return
    }
    if (localUserInfo.modifyNameChance === 0) {
      showFeedback(t('home.profile_edit.toast.rename_limit'), 'error')
      return
    }
    matrixAccountService.updateDisplayName(localUserInfo.name!).then(() => {
      const currentUserInfo = userStore.userInfo
      if (!currentUserInfo) {
        showFeedback(t('home.profile_edit.toast.save_failed'), 'error')
        return
      }

      currentUserInfo.name = localUserInfo.name!
      loginHistoriesStore.updateLoginHistory(<UserInfoType>currentUserInfo)
      updateCurrentUserCache('name', localUserInfo.name)
      if (!editInfo.value.content.modifyNameChance) return
      editInfo.value.content.modifyNameChance -= 1
      showFeedback(t('home.profile_edit.toast.save_success'), 'success')
    })
  }

  /** 佩戴徽章 */
  const toggleWarningBadge = async (badge: BadgeType) => {
    if (!badge?.id) return
    try {
      await badgeService.setUserBadge(badge.id)
      editInfo.value.badgeList = editInfo.value.badgeList.map((item) => ({
        ...item,
        wearing: item.id === badge.id ? IsYesEnum.YES : IsYesEnum.NO,
        obtain: item.obtain
      }))
      // 确保在状态更新后再显示成功消息
      nextTick(() => {
        showFeedback(t('home.profile_edit.toast.badge_wear_success'), 'success')
      })
    } catch {
      showFeedback(t('home.profile_edit.toast.badge_wear_failed'), 'error')
    }
  }

  /* 打开并且创建modal */
  const handleEditing = () => {
    useMitt.emit(MittEnum.OPEN_EDIT_INFO)
  }

  /**
   * 侧边栏部分跳转窗口路由事件
   * @param url 跳转的路由
   * @param title 创建窗口时的标题
   * @param size 窗口的大小
   * @param window 窗口参数
   * */
  const pageJumps = (
    url: string,
    title?: string,
    size?: { width: number; height: number; minWidth?: number; minHeight?: number },
    window?: { resizable: boolean }
  ) => {
    if (window) {
      useTimeoutFn(async () => {
        logger.info(`打开窗口: ${title}`)
        const webview = await createWebviewWindow(
          title!,
          url,
          <number>size?.width,
          <number>size?.height,
          '',
          window?.resizable,
          <number>size?.minWidth,
          <number>size?.minHeight
        )
        // 非 Tauri 环境下 createWebviewWindow 返回 null，回退到路由跳转
        if (!webview) {
          activeUrl.value = url
          router.push(`/${url}`)
          return
        }
        openWindowsList.value.add(url)

        const unlisten = await webview?.onCloseRequested(() => {
          openWindowsList.value.delete(url)
          if (unlisten) unlisten()
        })
      }, 300)
    } else {
      activeUrl.value = url
      router.push(`/${url}`)
    }
  }

  /**
   * 打开内容对应窗口
   * @param title 窗口的标题
   * @param label 窗口的标识
   * @param w 窗口的宽度
   * @param h 窗口的高度
   * */
  const openContent = (title: string, label: string, w = 840, h = 600) => {
    useTimeoutFn(async () => {
      await createWebviewWindow(title, label, w, h)
    }, 300)
    infoShow.value = false
  }

  const closeMenu = (event: MouseEvent) => {
    if (event.target instanceof HTMLElement && !event.target.matches('.setting-item, .more, .more *')) {
      settingShow.value = false
    }
  }

  onMounted(async () => {
    /** 页面加载的时候默认显示消息列表 */
    pageJumps(activeUrl.value)
    window.addEventListener('click', closeMenu, true)

    useMitt.on(MittEnum.SHRINK_WINDOW, (event: boolean) => {
      shrinkStatus.value = event
    })
    useMitt.on(MittEnum.CLOSE_INFO_SHOW, () => {
      infoShow.value = false
    })
    useMitt.on(MittEnum.TO_SEND_MSG, (event: { url: string }) => {
      activeUrl.value = event.url
    })
  })

  onUnmounted(() => {
    window.removeEventListener('click', closeMenu, true)
  })

  return {
    currentState,
    activeUrl,
    settingShow,
    shrinkStatus,
    infoShow,
    tipShow,
    themeColor,
    openWindowsList,
    editInfo,
    currentBadge,
    handleEditing,
    pageJumps,
    openContent,
    saveEditInfo,
    toggleWarningBadge,
    updateCurrentUserCache,
    followOS
  }
}
