<template>
  <div
    class="login-form-root"
    style="display: flex; flex-direction: column; align-items: center; width: 100%; box-sizing: border-box">
    <div
      class="login-avatar-row"
      data-tauri-drag-region
      style="display: flex; justify-content: center; width: 100%; margin: 8px 0 20px; box-sizing: border-box">
      <div class="login-avatar-wrap relative">
        <n-avatar
          class="welcome size-80px rounded-50% border-(3px solid [--login-avatar-border])"
          :color="'var(--login-avatar-bg)'"
          alt="Tjg Logo"
          :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          :src="AvatarUtils.getAvatarUrl(loginInfo.avatar)" />
      </div>
    </div>

    <div
      class="login-form-body"
      style="display: flex; flex-direction: column; gap: 14px; width: 300px; max-width: 100%; box-sizing: border-box">
      <!-- 服务器地址（家服务）输入框 -->
      <div class="homeserver-wrap">
        <n-input
          size="large"
          v-model:value="homeserverUrl"
          type="text"
          :placeholder="t('login.input.homeserver.placeholder')"
          :title="t('login.input.homeserver.toggle_title')"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable>
          <template #prefix>
            <svg
              class="size-16px color-[--tjg-text-secondary] flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <rect x="3" y="4" width="18" height="6" rx="1.5" />
              <rect x="3" y="14" width="18" height="6" rx="1.5" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
              <line x1="7" y1="17" x2="7.01" y2="17" />
            </svg>
          </template>
          <template #suffix>
            <div
              class="cursor-pointer color-[--tjg-text-secondary]"
              :title="t('login.input.homeserver.toggle_title')"
              @click="showServerAdvanced = !showServerAdvanced">
              <svg
                class="w-14px h-14px transition-transform duration-200"
                :class="{ 'rotate-180': showServerAdvanced }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </template>
        </n-input>
        <!-- 高级服务器设置折叠提示 -->
        <transition name="server-advanced">
          <div v-if="showServerAdvanced" class="homeserver-hint">
            <svg
              class="size-11px flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{{ t('login.input.homeserver.advanced_hint') }}</span>
          </div>
        </transition>
      </div>

      <n-input
        :class="{ 'pl-16px': loginHistories.length > 0 }"
        size="large"
        v-model:value="loginInfo.account"
        type="text"
        :placeholder="accountPH"
        @focus="accountPH = ''"
        @blur="accountPH = t('login.input.account.placeholder')"
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        clearable>
        <template #suffix>
          <div v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
            <svg v-if="!arrowStatus" class="down w-18px h-18px color-[--tjg-text-secondary] cursor-pointer">
              <use href="#down"></use>
            </svg>
            <svg v-else class="down w-18px h-18px color-[--tjg-text-secondary] cursor-pointer">
              <use href="#up"></use>
            </svg>
          </div>
        </template>
      </n-input>

      <div
        v-if="loginHistories.length > 0 && arrowStatus"
        class="account-box absolute max-h-140px bg-[--login-dropdown-bg] backdrop-blur-sm mt-45px z-99 rounded-8px p-8px box-border"
        style="width: 100%; max-width: 340px; border: 1px solid var(--login-dropdown-border)">
        <n-scrollbar style="max-height: 120px" trigger="none">
          <div
            v-for="item in loginHistories"
            :key="item.account"
            @click="giveAccount(item)"
            class="p-8px cursor-pointer hover:bg-[--tjg-text-tertiary]20 dark:hover:bg-[--tjg-text-tertiary]30 hover:rounded-6px">
            <div class="flex-between-center">
              <n-avatar
                :src="AvatarUtils.getAvatarUrl(item.avatar)"
                :color="'var(--login-avatar-bg)'"
                class="size-28px rounded-50%" />
              <p class="text-14px color-[--tjg-text-secondary]">{{ item.account }}</p>
              <svg @click.stop="delAccount(item)" class="w-12px h-12px color-[--tjg-text-secondary]">
                <use href="#close"></use>
              </svg>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <n-input
        class="pl-16px"
        maxlength="16"
        minlength="6"
        size="large"
        show-password-on="click"
        v-model:value="loginInfo.password"
        type="password"
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        :placeholder="passwordPH"
        @focus="passwordPH = ''"
        @blur="passwordPH = t('login.input.pass.placeholder')"
        clearable />

      <div class="protocol-row">
        <n-checkbox v-model:checked="protocol" :aria-label="t('login.term.checkout.text1')" />
        <div class="text-12px color-[--tjg-text-tertiary] cursor-default lh-14px agreement">
          <span>{{ t('login.term.checkout.text1') }}</span>
          <span class="color-[--tjg-color-primary-500] cursor-pointer" @click.stop="emit('open-service-agreement')">
            {{ t('login.term.checkout.text2') }}
          </span>
          <span>{{ t('login.term.checkout.text3') }}</span>
          <span class="color-[--tjg-color-primary-500] cursor-pointer" @click.stop="emit('open-privacy-agreement')">
            {{ t('login.term.checkout.text4') }}
          </span>
        </div>
      </div>

      <n-button
        :loading="loading"
        :disabled="loginDisabled"
        style="color: var(--tjg-text-inverse)"
        class="gradient-button w-full mt-4px mb-4px"
        @click="emit('login')">
        <span>{{ loginText }}</span>
      </n-button>

      <div v-if="loginStatus === 'failed' && lastLoginError" class="login-error-retry">
        <p class="login-error-retry__message">{{ lastLoginError }}</p>
        <n-button size="small" type="primary" tertiary @click="emit('retry')">
          {{ t('login.status.retry') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import type { UserInfoType } from '@/services/types.ts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = defineProps<{
  loading: boolean
  loginDisabled: boolean
  loginText: string
  loginStatus?: 'idle' | 'connecting' | 'success' | 'failed'
  lastLoginError?: string | null
}>()

const emit = defineEmits<{
  login: []
  retry: []
  'open-service-agreement': []
  'open-privacy-agreement': []
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = storeToRefs(loginHistoriesStore)

const loginInfo = defineModel<{
  account: string
  password: string
  avatar: string
  name: string
  uid: string
}>('loginInfo', { required: true })

const protocol = defineModel<boolean>('protocol', { required: true })
const homeserverUrl = defineModel<string>('homeserverUrl', { required: true })

const arrowStatus = ref(false)
const showServerAdvanced = ref(false)
const accountPH = ref(t('login.input.account.placeholder'))
const passwordPH = ref(t('login.input.pass.placeholder'))

const delAccount = (item: UserInfoType) => {
  const lengthBeforeDelete = loginHistories.value.length
  loginHistoriesStore.removeLoginHistory(item)
  if (lengthBeforeDelete === 1 && loginHistories.value.length === 0) {
    arrowStatus.value = false
  }
  loginInfo.value.account = ''
  loginInfo.value.password = ''
  loginInfo.value.avatar = '/logoD.png'
}

const giveAccount = (item: UserInfoType) => {
  const { account, password, avatar, name, uid } = item
  loginInfo.value.account = account || ''
  loginInfo.value.password = password || ''
  loginInfo.value.avatar = avatar
  loginInfo.value.name = name
  loginInfo.value.uid = uid
  arrowStatus.value = false
}

watch(
  () => loginInfo.value.account,
  (newAccount) => {
    if (!newAccount) {
      loginInfo.value.avatar = '/logoD.png'
      return
    }

    const matchedAccount = loginHistories.value.find(
      (history) => history.account === newAccount || history.email === newAccount
    )
    if (matchedAccount) {
      loginInfo.value.avatar = matchedAccount.avatar
    } else {
      loginInfo.value.avatar = '/logoD.png'
    }
  }
)

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
})
</script>

<style scoped>
/* 根容器：flex 列布局，子元素水平居中 */
.login-form-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

/* 头像行：居中 */
.login-avatar-row {
  display: flex;
  justify-content: center;
  width: 100%;
}

/* 表单主体：固定宽度 300px（按原型 auth-form max-width），由父容器 align-items: center 居中 */
.login-form-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 300px;
  max-width: 100%;
  box-sizing: border-box;
}

/* 确保表单内的 n-input 填满父容器宽度 */
.login-form-body :deep(.n-input) {
  width: 100%;
}

/* homeserver-wrap 仅作为输入框 + 折叠提示的容器 */
.homeserver-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 4px;
}

/* 协议行 */
.protocol-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.login-error-retry__message {
  font-size: 12px;
  line-height: 16px;
  color: var(--tjg-color-danger-600, #dc2626);
  text-align: center;
  margin: 0;
}

.homeserver-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 14px;
  color: var(--tjg-text-tertiary);
  text-align: left;
}

.server-advanced-enter-active,
.server-advanced-leave-active {
  transition:
    opacity 0.25s ease,
    max-height 0.25s ease;
  overflow: hidden;
  max-height: 60px;
}

.server-advanced-enter-from,
.server-advanced-leave-to {
  opacity: 0;
  max-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .server-advanced-enter-active,
  .server-advanced-leave-active {
    transition: none;
  }
  .rotate-180 {
    transition: none;
  }
}
</style>
