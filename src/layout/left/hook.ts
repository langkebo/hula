import { info } from '@tauri-apps/plugin-log'
import { useTimeoutFn } from '@vueuse/core'
import { MittEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import type { BadgeType, UserInfoType } from '@/services/types.ts'
import { useGroupStore } from '@/stores/group'
import { useLoginHistoriesStore } from '@/stores/loginHistory.ts'
import { useMenuTopStore } from '@/stores/menuTop.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user.ts'
import { useUserStatusStore } from '@/stores/userStatus.ts'
import { useEditInfoStore } from '@/stores/editInfo'
import { matrixAccountService } from '@/services/matrix'
import { storeToRefs } from 'pinia'

export const leftHook = () => {
  const prefers = matchMedia('(prefers-color-scheme: dark)')
  const { createWebviewWindow } = useWindow()
  const settingStore = useSettingStore()
  const { menuTop } = storeToRefs(useMenuTopStore())
  const loginHistoriesStore = useLoginHistoriesStore()
  const userStore = useUserStore()
  const { themes } = settingStore
  const userStatusStore = useUserStatusStore()
  const { currentState } = storeToRefs(userStatusStore)
  const activeUrl = ref<string>(menuTop.value?.[0]?.url || 'message')
  const settingShow = ref(false)
  const shrinkStatus = ref(false)
  const groupStore = useGroupStore()
  const infoShow = ref(false)
  const tipShow = ref(true)
  const themeColor = ref(themes.content === ThemeEnum.DARK ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)')
  const openWindowsList = ref(new Set())

  const editInfoStore = useEditInfoStore()

  const followOS = () => {
    themeColor.value = prefers.matches ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)'
  }

  watchEffect(() => {
    if (themes.pattern === ThemeEnum.OS) {
      followOS()
      prefers.addEventListener('change', followOS)
    } else {
      prefers.removeEventListener('change', followOS)
    }
  })

  const updateCurrentUserCache = (key: 'name' | 'wearingItemId' | 'avatar', value: string | number) => {
    const currentUser = userStore.userInfo!.uid && groupStore.getUserInfo(userStore.userInfo!.uid)
    if (currentUser) {
      ;(currentUser as unknown as Record<string, unknown>)[key] = value
    }
  }

  const saveEditInfo = (localUserInfo: Partial<UserInfoType>) => {
    if (!localUserInfo.name || localUserInfo.name.trim() === '') {
      window.$message.error('昵称不能为空')
      return
    }
    if (localUserInfo.modifyNameChance === 0) {
      window.$message.error('改名次数不足')
      return
    }
    matrixAccountService.updateDisplayName(localUserInfo.name!).then(() => {
      userStore.userInfo!.name = localUserInfo.name!
      loginHistoriesStore.updateLoginHistory(userStore.userInfo as UserInfoType)
      if (localUserInfo.name) {
        updateCurrentUserCache('name', localUserInfo.name)
      }
      const currentChance = editInfoStore.content.modifyNameChance
      if (currentChance) {
        editInfoStore.updateContent({ modifyNameChance: currentChance - 1 })
      }
      window.$message.success('保存成功')
    })
  }

  const toggleWarningBadge = async (badge: BadgeType) => {
    if (!badge?.id) return
    try {
      await setUserBadge({ badgeId: badge.id })
      const currentUser = userStore.userInfo!.uid && groupStore.getUserInfo(userStore.userInfo!.uid)
      if (currentUser) {
        currentUser.wearingItemId = badge.id
        userStore.userInfo!.wearingItemId = badge.id
        editInfoStore.wearBadge(badge.id)
      }
      nextTick(() => {
        window.$message.success('佩戴成功')
      })
    } catch {
      window.$message.error('佩戴失败，请稍后重试')
    }
  }

  const handleEditing = () => {
    editInfoStore.openEditInfo(userStore.userInfo!)
  }

  const pageJumps = (
    url: string,
    title?: string,
    size?: { width: number; height: number; minWidth?: number; minHeight?: number },
    window?: { resizable: boolean }
  ) => {
    if (window) {
      useTimeoutFn(async () => {
        info(`打开窗口: ${title}`)
        const webview = await createWebviewWindow(
          title!,
          url,
          size?.width as number,
          size?.height as number,
          '',
          window?.resizable,
          size?.minWidth as number,
          size?.minHeight as number
        )
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

  const openContent = (title: string, label: string, w = 840, h = 600) => {
    useTimeoutFn(async () => {
      await createWebviewWindow(title, label, w, h)
    }, 300)
    infoShow.value = false
  }

  const closeMenu = (event: Event) => {
    if (!(event.target as HTMLElement).matches('.setting-item, .more, .more *')) {
      settingShow.value = false
    }
  }

  onMounted(async () => {
    pageJumps(activeUrl.value)
    window.addEventListener('click', closeMenu, true)

    useMitt.on(MittEnum.SHRINK_WINDOW, (event) => {
      shrinkStatus.value = event as boolean
    })
    useMitt.on(MittEnum.CLOSE_INFO_SHOW, () => {
      infoShow.value = false
    })
    useMitt.on(MittEnum.TO_SEND_MSG, (event) => {
      const data = event as { url: string }
      activeUrl.value = data.url
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
    editInfoStore,
    currentBadge: computed(() => editInfoStore.currentBadge),
    handleEditing,
    pageJumps,
    openContent,
    saveEditInfo,
    toggleWarningBadge,
    updateCurrentUserCache,
    followOS
  }
}
