<template>
  <n-flex vertical :size="22">
    <n-flex justify="center" class="w-full pt-12px" data-tauri-drag-region>
      <n-avatar
        class="welcome size-80px rounded-50% border-(2px solid [--login-avatar-border])"
        :color="'var(--login-avatar-bg)'"
        alt="Tjg Logo"
        :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
        :src="AvatarUtils.getAvatarUrl(loginInfo.avatar)" />
    </n-flex>

    <n-flex class="ma text-center h-full w-260px" vertical :size="16">
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
          <n-flex v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
            <svg v-if="!arrowStatus" class="down w-18px h-18px color-[--tjg-text-secondary] cursor-pointer">
              <use href="#down"></use>
            </svg>
            <svg v-else class="down w-18px h-18px color-[--tjg-text-secondary] cursor-pointer">
              <use href="#up"></use>
            </svg>
          </n-flex>
        </template>
      </n-input>

      <div
        style="border: 1px solid var(--login-dropdown-border)"
        v-if="loginHistories.length > 0 && arrowStatus"
        class="account-box absolute w-260px max-h-140px bg-[--login-dropdown-bg] backdrop-blur-sm mt-45px z-99 rounded-8px p-8px box-border">
        <n-scrollbar style="max-height: 120px" trigger="none">
          <n-flex
            vertical
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
          </n-flex>
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

      <n-flex align="center" justify="center" :size="6">
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
      </n-flex>

      <n-button
        :loading="loading"
        :disabled="loginDisabled"
        tertiary
        style="color: var(--tjg-text-inverse)"
        class="gradient-button w-full mt-8px mb-10px"
        @click="emit('login')">
        <span>{{ loginText }}</span>
      </n-button>

      <div v-if="loginStatus === 'failed' && lastLoginError" class="login-error-retry">
        <p class="login-error-retry__message">{{ lastLoginError }}</p>
        <n-button size="small" type="primary" tertiary @click="emit('retry')">
          {{ t('login.status.retry') }}
        </n-button>
      </div>
    </n-flex>
  </n-flex>
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
.login-error-retry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 4px;
  background: var(--tjg-color-danger-50);
  border: 1px solid var(--tjg-color-danger-200);
  border-radius: 6px;
}

.login-error-retry__message {
  font-size: 12px;
  line-height: 16px;
  color: var(--tjg-color-danger-600, #dc2626);
  text-align: center;
  margin: 0;
}
</style>
