<template>
  <!-- 锁屏页面 -->
  <div
    data-tauri-drag-region
    @keydown.esc="preventEscClose"
    class="login-box overflow-y-hidden rounded-8px select-none absolute top-0 left-0 w-full h-full z-9999 transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-300 ease-in-out">
    <ActionBar
      class="absolute top-0 right-0 z-99999"
      :current-label="currentWindowLabel"
      :shrink="false"
      :esc-close="false" />

    <Transition name="slide-fade" appear>
      <!--  壁纸界面  -->
      <div v-clickable v-if="!isUnlockPage" @click.stop="isUnlockPage = true" class="size-full rounded-8px">
        <n-flex vertical align="center" :size="120" class="size-full mt-10%">
          <n-flex vertical align="center" :size="20" class="will-change-auto will-change-contents">
            <p class="text-(100px [--tjg-text-secondary]) font-500">{{ currentTime }}</p>
            <n-flex align="center" :size="30" class="text-(30px [--tjg-text-secondary])">
              <p>{{ currentMonthAndDate }}</p>
              <p>{{ currentWeekday }}</p>
            </n-flex>
          </n-flex>

          <n-flex vertical justify="center" align="center" :size="20" class="tips">
            <svg aria-hidden="true"><use href="#search"></use></svg>
            <p class="text-(16px [--tjg-text-secondary]) text-center leading-24px">
              {{ t('message.lock_screen.tip_description') }}
            </p>
          </n-flex>
        </n-flex>
      </div>

      <!-- 解锁界面  -->
      <n-flex
        v-else
        data-tauri-drag-region
        vertical
        align="center"
        justify="center"
        :size="16"
        class="h-full backdrop-blur-md rounded-8px">
        <n-flex vertical align="center" justify="center" :size="30" class="mt--75px">
          <n-avatar
            round
            class="lock-border"
            :size="120"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ?? '')" />
          <p class="text-(24px [--tjg-text-secondary]) font-500">{{ userStore.userInfo?.name ?? '' }}</p>

          <!-- 密码输入框 -->
          <n-input
            v-if="!isLogining"
            ref="inputInstRef"
            class="lock-input"
            :class="{ 'lock-input--shake': isShaking }"
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            :placeholder="t('message.lock_screen.password_placeholder')"
            :input-props="{ 'aria-invalid': showError ? 'true' : 'false' }"
            show-password-on="click"
            type="password"
            @update:value="clearError"
            v-model:value="password">
            <template #suffix>
              <n-popover trigger="hover">
                <template #trigger>
                  <svg
                    @click.stop="unlock"
                    class="size-16px text-[--tjg-text-secondary] mr-6px p-[4px_6px] rounded-8px cursor-pointer transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-300 ease-in-out hover:bg-[--tjg-color-primary-600]"
                    v-clickable="t('message.lock_screen.enter_system_tooltip')">
                    <use href="#arrow-right"></use>
                  </svg>
                </template>
                <p>{{ t('message.lock_screen.enter_system_tooltip') }}</p>
              </n-popover>
            </template>
          </n-input>

          <!-- 错误提示：空密码与密码错误共用同一行，避免主按钮位置跳动 -->
          <p v-if="!isLogining && errorMessage" class="lock-error" role="alert">{{ errorMessage }}</p>

          <!-- 主按钮：始终可见的解锁入口 -->
          <button v-if="!isLogining" type="button" class="lock-unlock-button" @click="unlock">
            {{ t('message.lock_screen.unlock_button') }}
          </button>

          <!-- 登录时显示的文字 -->
          <n-flex v-if="isLogining" vertical align="center" justify="center" :size="30">
            <img class="size-42px" src="@/assets/img/loading-one.svg" :alt="t('common.loading')" />
            <p class="text-(20px [--tjg-text-secondary])">{{ t('message.lock_screen.unlocking') }}</p>
          </n-flex>
        </n-flex>

        <n-flex
          v-if="!isLogining"
          justify="space-around"
          align="center"
          :size="0"
          class="options text-(14px [--tjg-text-secondary])">
          <p @click="isUnlockPage = false">{{ t('message.lock_screen.return_action') }}</p>
          <p @click="logout">{{ t('message.lock_screen.logout_action') }}</p>
          <p @click="unlock">{{ t('message.lock_screen.enter_system_action') }}</p>
        </n-flex>
      </n-flex>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onKeyStroke } from '@vueuse/core'
import dayjs from 'dayjs'
import type { InputInst } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { EventEnum } from '@/enums'
import { useLoginFlow } from '@/shared/composables/useLoginFlow'
import { verifyLockScreenVerifier } from '@/stores/domains/settings/lockScreenCredential'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { getWeekday } from '@/utils/ComputedTime'
import { useTimerManager } from '@/utils/TimerManager'

const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const currentWindowLabel = computed(() => appWindow?.label ?? '')
const settingStore = useSettingStore()
const userStore = useUserStore()
const { lockScreen } = storeToRefs(settingStore)
const { logout } = useLoginFlow()
const { t } = useI18n()
const timerManager = useTimerManager()
/** 解锁密码 */
const password = ref('')
/** 是否是解锁页面 */
const isUnlockPage = ref(false)
/** 是否是登录中 */
const isLogining = ref(false)
/** 密码不正确时显示 */
const isWrongPassword = ref(false)
/** 密码为空时显示 */
const isEmptyPassword = ref(false)
/** 输入框抖动反馈 */
const isShaking = ref(false)
/** Enter 键监听清理函数 */
let stopEnterListener: (() => void) | null = null
/** 当前时间 */
const currentTime = ref(dayjs().format('HH:mm'))
/** 当前月份和日期 */
const currentMonthAndDate = ref(dayjs().format('MM/DD'))
// const currentMonthAndDate = ref(new Date().toLocaleDateString('chinese', { month: 'long', day: 'numeric' }))
/** 当前星期 */
const currentWeekday = ref(getWeekday(new Date().toLocaleString()))
/** 密码输入框实例 */
const inputInstRef = ref<InputInst | null>(null)
/** 是否有错误提示 */
const showError = computed(() => isWrongPassword.value || isEmptyPassword.value)
/** 错误提示文案：密码错误复用现有文案，空密码提示重新输入 */
const errorMessage = computed(() => {
  if (isWrongPassword.value) return t('message.lock_screen.wrong_password')
  if (isEmptyPassword.value) return t('message.lock_screen.toast_empty_password')
  return ''
})
/** 白名单窗口（锁屏时不隐藏的窗口） */
const whitelistWindows = ['home', 'tray', 'capture', 'checkupdate', 'notify']
/** 被隐藏的窗口列表 */
const hiddenWindows = ref<string[]>([])

watch(isUnlockPage, (val) => {
  if (val) {
    timerManager.setTimeout(() => {
      inputInstRef.value?.focus()
    }, 300)
  }
})

/** 用户重新输入时清除上一次的错误提示 */
const clearError = () => {
  isWrongPassword.value = false
  isEmptyPassword.value = false
}

/** 拦截 Esc：阻止冒泡到 ActionBar 的全局监听，避免锁屏被关闭 */
const preventEscClose = (event: KeyboardEvent) => {
  event.preventDefault()
  event.stopPropagation()
}

/** 解锁：校验 PBKDF2 verifier，成功后广播跨窗口解锁 */
const unlock = async () => {
  if (isLogining.value) return
  clearError()

  if (password.value === '') {
    isEmptyPassword.value = true
    isShaking.value = true
    timerManager.setTimeout(() => {
      isShaking.value = false
    }, 400)
    inputInstRef.value?.focus()
    return
  }

  /** 无可用凭据时直接放行，避免渲染无法解锁的锁定层 */
  if (lockScreen.value.passwordHash === '') {
    lockScreen.value.enable = false
    return
  }

  isLogining.value = true
  const passed = await verifyLockScreenVerifier(password.value, lockScreen.value.passwordHash)
  timerManager.setTimeout(
    async () => {
      isLogining.value = false
      if (passed) {
        lockScreen.value.enable = false
        if (hasTauriRuntime()) {
          await emit(EventEnum.UNLOCK_SCREEN)
        }
        return
      }
      isWrongPassword.value = true
      inputInstRef.value?.focus()
    },
    passed ? 1000 : 300
  )
}

/** 隐藏其他窗口 */
const hideOtherWindows = async () => {
  const allWindows = await WebviewWindow.getAll()
  const windowsToHide = allWindows.filter(
    (window) => !whitelistWindows.includes(window.label) && window.label !== 'lockScreen'
  )

  for (const window of windowsToHide) {
    await window.hide()
    hiddenWindows.value.push(window.label)
  }
}

/** 显示之前隐藏的窗口 */
const showHiddenWindows = async () => {
  for (const windowLabel of hiddenWindows.value) {
    const window = await WebviewWindow.getByLabel(windowLabel)
    if (window) {
      await window.show()
    }
  }
  hiddenWindows.value = []
}

// 监听锁屏状态变化
watchEffect(() => {
  if (!lockScreen.value.enable) {
    // 解锁时显示之前隐藏的窗口
    showHiddenWindows()
  }
})

onMounted(() => {
  timerManager.setInterval(() => {
    currentTime.value = dayjs().format('HH:mm')
    currentMonthAndDate.value = dayjs().format('MM/DD')
    currentWeekday.value = getWeekday(new Date().toLocaleString())
  }, 1000)

  /** 唯一的 Enter 监听：壁纸界面先进入解锁页，解锁页校验密码 */
  stopEnterListener = onKeyStroke(
    'Enter',
    (event) => {
      if (isLogining.value) return
      event.preventDefault()
      if (!isUnlockPage.value) {
        isUnlockPage.value = true
        return
      }
      void unlock()
    },
    { dedupe: true }
  )

  hideOtherWindows()
})

onUnmounted(() => {
  stopEnterListener?.()
  stopEnterListener = null
  timerManager.clearAll()
})
</script>
<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';

.options {
  @apply w-320px;
  p {
    @apply cursor-pointer select-none;
  }
}

.tips {
  @apply cursor-pointer w-240px p-12px rounded-8px transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-300 ease-in-out;
  svg {
    @apply size-24px p-4px rounded-8px;
    color: var(--lock-icon-color, var(--tjg-surface-subtle));
    background-color: var(--lock-icon-bg, rgba(128, 128, 128, 0.5));
  }
}

:deep(.hover-box),
:deep(.action-close) {
  svg {
    color: var(--lock-action-color, var(--tjg-text-inverse));
  }
}
:deep(.hover-box) {
  &:hover {
    background-color: var(--lock-hover-bg, var(--tjg-surface-sidebar-active));
  }
}
:deep(.n-input .n-input__input-el, .n-input .n-input__textarea-el) {
  color: var(--lock-input-color, var(--tjg-text-inverse));
}

/*
  进入和离开动画可以使用不同
  持续时间和速度曲线。
*/
.slide-fade-enter-active {
  transition:
    color var(--tjg-motion-duration-normal) ease-in-out,
    background-color var(--tjg-motion-duration-normal) ease-in-out,
    border-color var(--tjg-motion-duration-normal) ease-in-out,
    box-shadow var(--tjg-motion-duration-normal) ease-in-out,
    opacity var(--tjg-motion-duration-normal) ease-in-out,
    transform var(--tjg-motion-duration-normal) ease-in-out;
}

.slide-fade-leave-active {
  transition:
    color var(--tjg-motion-duration-xslow) cubic-bezier(1, 0.5, 0.8, 1),
    background-color var(--tjg-motion-duration-xslow) cubic-bezier(1, 0.5, 0.8, 1),
    border-color var(--tjg-motion-duration-xslow) cubic-bezier(1, 0.5, 0.8, 1),
    box-shadow var(--tjg-motion-duration-xslow) cubic-bezier(1, 0.5, 0.8, 1),
    opacity var(--tjg-motion-duration-xslow) cubic-bezier(1, 0.5, 0.8, 1),
    transform var(--tjg-motion-duration-xslow) cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
.lock-border {
  border: 2px solid var(--lock-border-color, var(--tjg-surface-subtle));
}

/*
  双类名是为提升特异性：naive-ui 的 `.n-input` 及其 `&:hover` / `--focus` 背景规则同为 (0,2,0)，
  单类名会退化为「由样式注入顺序决定」；锁屏输入框底色必须恒定，故提到 (0,3,0)。
*/
.lock-input.lock-input {
  width: 320px;
  border: 2px solid var(--tjg-border-contrast);
  border-bottom-color: var(--tjg-color-primary-500);
  background-color: var(--lock-input-bg, var(--tjg-surface-panel-muted));
  color: var(--lock-input-color, var(--tjg-text-inverse));
}

.lock-error {
  @apply m-0 text-(14px [--tjg-color-danger-500]);
}

.lock-unlock-button {
  @apply w-320px cursor-pointer select-none rounded-8px border-0 p-[10px_16px] text-(15px [--tjg-text-inverse]) font-500 transition-[background-color,box-shadow] duration-200 ease-in-out;
  background-color: var(--tjg-color-primary-600);

  &:hover {
    background-color: var(--tjg-color-primary-500);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-400);
    outline-offset: 2px;
  }
}

.lock-input--shake {
  animation: lock-shake 0.4s ease-in-out;
}

@keyframes lock-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-6px);
  }
  40% {
    transform: translateX(6px);
  }
  60% {
    transform: translateX(-4px);
  }
  80% {
    transform: translateX(4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lock-input--shake {
    animation: none;
  }
}
</style>
