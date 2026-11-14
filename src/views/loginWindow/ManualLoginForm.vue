<template>
  <div class="login-form-root">
    <div class="login-avatar-row" data-tauri-drag-region>
      <div class="login-avatar-wrap relative">
        <n-avatar
          class="welcome size-80px rounded-50% border-(3px solid [--login-avatar-border])"
          :color="'var(--login-avatar-bg)'"
          alt="Tjg Logo"
          fallback-src="/logo.png"
          :src="AvatarUtils.getAvatarUrl(loginInfo.avatar)" />
      </div>
    </div>

    <div class="login-form-body">
      <!-- 服务器地址（家服务）输入框 + 高级设置折叠提示 -->
      <LoginHomeserverField v-model:homeserver-url="homeserverUrl" />

      <label class="sr-only" for="login-account">{{ t('login.input.account.placeholder') }}</label>
      <n-input
        :class="{ 'pl-16px': loginHistories.length > 0 }"
        size="large"
        v-model:value="loginInfo.account"
        type="text"
        :placeholder="accountPH"
        :input-props="{
          id: 'login-account',
          name: 'username',
          autocomplete: 'username',
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off'
        }"
        @focus="accountPH = ''"
        @blur="accountPH = t('login.input.account.placeholder')"
        clearable>
        <template #suffix>
          <button
            v-if="loginHistories.length > 0"
            type="button"
            class="login-history-toggle"
            :aria-label="t('login.input.account.placeholder')"
            :aria-expanded="arrowStatus"
            @click="arrowStatus = !arrowStatus">
            <svg v-if="!arrowStatus" class="down w-18px h-18px color-[--tjg-text-secondary]" aria-hidden="true">
              <use href="#down"></use>
            </svg>
            <svg v-else class="down w-18px h-18px color-[--tjg-text-secondary]" aria-hidden="true">
              <use href="#up"></use>
            </svg>
          </button>
        </template>
      </n-input>

      <div
        v-if="loginHistories.length > 0 && arrowStatus"
        class="account-box absolute max-h-140px bg-[--login-dropdown-bg] backdrop-blur-sm mt-45px z-99 rounded-8px p-8px box-border w-full max-w-340px border-1 border-solid border-[--login-dropdown-border]">
        <n-scrollbar class="max-h-120px" trigger="none">
          <ul class="login-history-list">
            <li v-for="item in loginHistories" :key="item.account" class="login-history-row">
              <button type="button" class="login-history-item" @click="giveAccount(item)">
                <n-avatar
                  :src="AvatarUtils.getAvatarUrl(item.avatar)"
                  :color="'var(--login-avatar-bg)'"
                  class="size-28px rounded-50%" />
                <p class="text-14px color-[--tjg-text-secondary]">{{ item.account }}</p>
              </button>
              <button
                type="button"
                class="login-history-delete"
                :aria-label="t('common.delete')"
                @click.stop="delAccount(item)">
                <svg class="w-12px h-12px color-[--tjg-text-secondary]" aria-hidden="true">
                  <use href="#close"></use>
                </svg>
              </button>
            </li>
          </ul>
        </n-scrollbar>
      </div>

      <label class="sr-only" for="login-password">{{ t('login.input.pass.placeholder') }}</label>
      <n-input
        maxlength="16"
        minlength="6"
        size="large"
        show-password-on="click"
        v-model:value="loginInfo.password"
        type="password"
        :input-props="{
          id: 'login-password',
          name: 'password',
          autocomplete: 'current-password',
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off'
        }"
        :placeholder="passwordPH"
        @focus="passwordPH = ''"
        @blur="passwordPH = t('login.input.pass.placeholder')"
        clearable />

      <div class="protocol-row">
        <n-checkbox v-model:checked="protocol" :aria-label="t('login.term.checkout.text1')" />
        <div class="text-12px color-[--tjg-text-tertiary] cursor-default lh-14px agreement">
          <span>{{ t('login.term.checkout.text1') }}</span>
          <span
            v-clickable
            class="color-[--tjg-color-primary-500] cursor-pointer"
            @click.stop="emit('open-service-agreement')">
            {{ t('login.term.checkout.text2') }}
          </span>
          <span>{{ t('login.term.checkout.text3') }}</span>
          <span
            v-clickable
            class="color-[--tjg-color-primary-500] cursor-pointer"
            @click.stop="emit('open-privacy-agreement')">
            {{ t('login.term.checkout.text4') }}
          </span>
        </div>
      </div>

      <n-button
        :loading="loading"
        :disabled="loginDisabled"
        :aria-label="loginText"
        :aria-busy="loading ? 'true' : 'false'"
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
import type { UserInfoType } from '@/services/types.ts'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { AvatarUtils } from '@/utils/AvatarUtils'
import LoginHomeserverField from '@/views/loginWindow/LoginHomeserverField.vue'

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
  loginInfo.value.avatar = '/logo.png'
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
      loginInfo.value.avatar = '/logo.png'
      return
    }

    const matchedAccount = loginHistories.value.find(
      (history) => history.account === newAccount || history.email === newAccount
    )
    if (matchedAccount) {
      loginInfo.value.avatar = matchedAccount.avatar
    } else {
      loginInfo.value.avatar = '/logo.png'
    }
  }
)

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.closest('.account-box, .login-history-toggle')) {
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
  margin: 8px 0 20px;
  box-sizing: border-box;
}

/* 表单主体：固定宽度 300px（按原型 TJG-prototype.html），由父容器 align-items: center 居中 */
.login-form-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 300px;
  max-width: 100%;
  box-sizing: border-box;
}

/* 渐变按钮样式（兼容 Naive UI / Vant 内部优先级） */
.gradient-button {
  /* .gradient-button 的完整样式由 login.scss 的全局规则覆盖，此处仅保留颜色兜底 */
}

/* 确保表单内的 n-input 填满父容器宽度 */
.login-form-body :deep(.n-input) {
  width: 100%;
}

/* 账号历史下拉：列表与可聚焦按钮 */
.login-history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.login-history-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--tjg-radius-md);
}

.login-history-row:hover {
  background: color-mix(in srgb, var(--tjg-text-tertiary) 20%, transparent);
}

.login-history-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--tjg-text-secondary);
}

.login-history-item {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 0;
  background: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
}

.login-history-item > p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-history-delete {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: 0;
  border-radius: var(--tjg-radius-md);
  background: none;
  cursor: pointer;
  color: inherit;
}

.login-history-toggle:focus-visible,
.login-history-item:focus-visible,
.login-history-delete:focus-visible {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 1px;
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
</style>
