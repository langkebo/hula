<template>
  <n-flex v-if="isTrayMenuShow" vertical :size="6" class="tray">
    <n-flex vertical :size="6">
      <n-flex
        v-for="item in stateList.slice(0, 6)"
        :key="item.id"
        v-memo="[item.id, item.title, item.url, stateId]"
        align="center"
        :size="10"
        @click="toggleStatus(item)"
        class="p-6px rounded-4px hover:bg-[--tray-hover]">
        <img class="size-14px" :src="item.url" alt="" />
        <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {{ translateStateTitle(item.title) }}
        </span>
      </n-flex>
      <n-flex
        @click="createWebviewWindow(t('message.tray.online_status_window_title'), 'onlineStatus', 320, 480)"
        align="center"
        :size="10"
        class="p-6px rounded-4px hover:bg-[--tray-hover]"
        v-once>
        <svg class="size-14px">
          <use href="#more"></use>
        </svg>
        <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{{ t('message.tray.more_status') }}</span>
      </n-flex>

      <component :is="division" />
      <n-flex
        @click="toggleMessageSound"
        align="center"
        :size="10"
        class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover]">
        <span>{{ messageSound ? t('message.tray.mute_all') : t('message.tray.unmute_all') }}</span>
      </n-flex>

      <component :is="division" />
      <n-flex
        @click="checkWinExist('home')"
        align="center"
        :size="10"
        class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover]"
        v-once>
        <span>{{ t('message.tray.open_main_panel') }}</span>
      </n-flex>

      <component :is="division" />
      <n-flex
        @click="handleExit"
        align="center"
        :size="10"
        class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover-e]"
        v-once>
        <span>{{ t('message.tray.exit') }}</span>
      </n-flex>
    </n-flex>
  </n-flex>

  <n-flex v-else vertical :size="6" class="tray">
    <n-flex
      @click="handleExit"
      align="center"
      :size="10"
      class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover-e]"
      v-once>
      <span>{{ t('message.tray.exit') }}</span>
    </n-flex>
  </n-flex>
</template>
<script setup lang="tsx">
import { TrayIcon } from '@tauri-apps/api/tray'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { exit } from '@tauri-apps/plugin-process'
import { useI18n } from 'vue-i18n'
import { useWindow } from '@/hooks/useWindow.ts'
import type { UserState } from '@/services/types'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { isWindows } from '@/utils/PlatformConstants'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('Tray')
const timerManager = useTimerManager()

const appWindow = WebviewWindow.getCurrent()
const { checkWinExist, createWebviewWindow, resizeWindow } = useWindow()
const userStatusStore = useUserStatusStore()
const settingStore = useSettingStore()
const globalStore = useGlobalStore()
const { lockScreen } = storeToRefs(settingStore)
const { stateList, stateId } = storeToRefs(userStatusStore)
const { tipVisible, isTrayMenuShow } = storeToRefs(globalStore)
const { t } = useI18n()
const isFocused = ref(false)
// 状态栏图标是否显示
const iconVisible = ref(false)

// 消息提示音状态
const messageSound = computed({
  get: () => settingStore.messageSoundEnabled,
  set: (value: boolean) => {
    settingStore.setMessageSoundEnabled(value)
  }
})

const division = () => {
  return <div class={'h-1px bg-[--hula-border-default] w-full'}></div>
}

const syncTrayMenuState = async (loggedIn?: boolean) => {
  globalStore.isTrayMenuShow = typeof loggedIn === 'boolean' ? loggedIn : !!(await WebviewWindow.getByLabel('home'))
}

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}

const handleExit = () => {
  /** 退出时关闭锁屏 */
  lockScreen.value.enable = false
  if (localStorage.getItem('wsLogin')) {
    localStorage.removeItem('wsLogin')
  }
  exit(0)
}

const toggleStatus = async (item: UserState) => {
  try {
    await userStatusStore.changeCurrentUserState(item)
    appWindow.hide()
  } catch (error) {
    logger.error('更新状态失败:', error)
    appWindow.hide()
  }
}

const toggleMessageSound = () => {
  appWindow.hide()
  nextTick(() => {
    messageSound.value = !messageSound.value
  })
}

let blinkTask: number | null = null
let homeFocusUnlisten: (() => void) | null = null
let homeBlurUnlisten: (() => void) | null = null

const startBlinkTask = () => {
  blinkTask = timerManager.setInterval(async () => {
    const tray = await TrayIcon.getById('tray')
    tray?.setIcon(iconVisible.value ? 'tray/icon.png' : null)
    iconVisible.value = !iconVisible.value
  }, 500)
}

const stopBlinkTask = async () => {
  if (blinkTask) {
    timerManager.clearInterval(blinkTask)
    blinkTask = null

    try {
      const tray = await TrayIcon.getById('tray')
      await tray?.setIcon('tray/icon.png')
    } catch (e) {
      logger.warn('恢复托盘图标失败:', e)
    }
    iconVisible.value = false
  }
}

watchEffect(async () => {
  if (isWindows()) {
    if (tipVisible.value && !isFocused.value) {
      startBlinkTask()
    } else {
      stopBlinkTask() // 停止图标闪烁
    }
  }
})

// 监听托盘窗口尺寸调整事件
const handleTrayResize = async () => {
  const islogin = await WebviewWindow.getByLabel('home')
  await resizeWindow('tray', 130, islogin ? 356 : 44)
}

onMounted(async () => {
  // 监听系统缩放变化事件，自动调整托盘窗口尺寸
  window.addEventListener('resize-needed', handleTrayResize)
  await syncTrayMenuState()

  if (isWindows()) {
    appWindow.listen<boolean>('tray_state_sync', async (event) => {
      await syncTrayMenuState(event.payload)
    })

    homeFocusUnlisten = await appWindow.listen('home_focus', async () => {
      isFocused.value = true
      await stopBlinkTask()
    })

    homeBlurUnlisten = await appWindow.listen('home_blur', () => {
      isFocused.value = false
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize-needed', handleTrayResize)
  if (homeFocusUnlisten) {
    homeFocusUnlisten()
    homeFocusUnlisten = null
  }
  if (homeBlurUnlisten) {
    homeBlurUnlisten()
    homeBlurUnlisten = null
  }
  stopBlinkTask()
})
</script>

<style scoped lang="scss">
.tray {
  @apply bg-[--hula-surface-panel] size-full p-8px box-border select-none text-[--hula-text-primary] text-12px;
}
</style>
