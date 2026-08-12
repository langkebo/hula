<template>
  <div data-testid="mobile-login-form" class="text-center w-80% flex flex-col gap-16px">
    <van-field
      :class="{ 'pl-22px': loginHistories.length > 0 }"
      v-model="userInfo.account"
      :placeholder="accountPH"
      @focus="accountPH = ''"
      @blur="accountPH = t('login.mobile.input.account_placeholder')"
      clearable
      autocomplete="off"
      :spellcheck="false"
      autocorrect="off"
      autocapitalize="off">
      <template #right-icon>
        <div v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
          <svg v-if="!arrowStatus" class="down w-18px h-18px color-[--chat-text-color]">
            <use href="#down"></use>
          </svg>
          <svg v-else class="down w-18px h-18px color-[--chat-text-color]"><use href="#up"></use></svg>
        </div>
      </template>
    </van-field>

    <!-- 账号选择框 -->
    <div
      style="border: 1px solid rgba(70, 70, 70, 0.1)"
      v-if="loginHistories.length > 0 && arrowStatus"
      class="account-box absolute w-80% max-h-140px bg-[--tjg-surface-elevated] mt-45px z-99 rounded-8px p-8px box-border">
      <div style="max-height: 120px; overflow-y: auto">
        <div
          v-for="item in loginHistories"
          :key="item.account"
          @click="onSelectAccount(item)"
          class="p-8px hover:bg-[--tjg-surface-panel-muted] hover:rounded-6px">
          <div class="flex-between-center">
            <img
              :src="AvatarUtils.getAvatarUrl(item.avatar)"
              alt="用户头像"
              class="size-28px bg-[--tjg-text-disabled] rounded-50% object-cover" />
            <p class="text-14px color-[--chat-text-color]">{{ item.account }}</p>
            <svg @click.stop="emit('delete-account', item)" class="w-12px h-12px">
              <use href="#close"></use>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <van-field
      class="pl-22px mt-8px"
      v-model="userInfo.password"
      :type="showLoginPassword ? 'text' : 'password'"
      :placeholder="passwordPH"
      @focus="passwordPH = ''"
      @blur="passwordPH = t('login.mobile.input.code_placeholder')"
      clearable
      autocomplete="off"
      :spellcheck="false"
      autocorrect="off"
      autocapitalize="off"
      :right-icon="showLoginPassword ? 'eye-o' : 'closed-eye'"
      @click-right-icon="showLoginPassword = !showLoginPassword" />

    <div class="flex justify-end">
      <van-button size="small" plain type="primary" @click="emit('forget-password')">
        {{ t('login.mobile.forget_code') }}
      </van-button>
    </div>

    <van-button
      data-testid="mobile-login-submit"
      :loading="loading"
      :disabled="loginDisabled"
      block
      class="mt-8px mb-50px gradient-button"
      @click="emit('login')">
      <span>{{ loginText }}</span>
    </van-button>

    <!-- 协议 -->
    <div class="flex items-center justify-center gap-6px absolute bottom-0 w-[80%]" :style="agreementStyle">
      <van-checkbox v-model="protocol" shape="square" icon-size="16px" />
      <div class="text-12px color-[--tjg-text-tertiary] cursor-default lh-14px">
        <span>{{ t('login.term.checkout.text1') }}</span>
        <span @click.stop="emit('to-service-agreement')" class="color-[--tjg-color-primary-500] cursor-pointer">
          {{ t('login.term.checkout.text2') }}
        </span>
        <span>{{ t('login.term.checkout.text3') }}</span>
        <span @click.stop="emit('to-privacy-agreement')" class="color-[--tjg-color-primary-500] cursor-pointer">
          {{ t('login.term.checkout.text4') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UserInfoType } from '@/services/types'
import { useMobileStore } from '@/stores/domains/settings/mobile'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isAndroid } from '@/utils/PlatformConstants'

/** 登录表单使用的用户信息子集（与 useLoginFlow 返回的 info 结构一致） */
interface LoginUserInfo {
  account: string
  password: string
  avatar: string
  name: string
  uid: string
}

const props = defineProps<{
  userInfo: LoginUserInfo
  loading: boolean
  loginText: string
  loginDisabled: boolean
  activeTab: 'login' | 'register'
}>()

const emit = defineEmits<{
  (e: 'update:protocol', value: boolean): void
  (e: 'select-account', item: UserInfoType): void
  (e: 'delete-account', item: UserInfoType): void
  (e: 'forget-password'): void
  (e: 'login'): void
  (e: 'to-service-agreement'): void
  (e: 'to-privacy-agreement'): void
}>()

const { t } = useI18n()
const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = storeToRefs(loginHistoriesStore)
const mobileStore = useMobileStore()
const safeArea = computed(() => mobileStore.safeArea)

const protocol = defineModel<boolean>('protocol', { default: true })

const accountPH = ref(t('login.mobile.input.account_placeholder'))
const passwordPH = ref(t('login.mobile.input.code_placeholder'))
const arrowStatus = ref(false)
const showLoginPassword = ref(false)

const agreementStyle = computed(() => {
  const inset = safeArea.value.bottom || 0
  if (isAndroid()) {
    return { bottom: `${inset + 10}px` }
  }
  if (inset > 0) {
    return { bottom: `${inset}px` }
  }
  return { bottom: 'var(--safe-area-inset-bottom)' }
})

const onSelectAccount = (item: UserInfoType) => {
  emit('select-account', item)
  arrowStatus.value = false
}

const resetLoginForm = () => {
  props.userInfo.account = ''
  props.userInfo.password = ''
  props.userInfo.avatar = ''
  props.userInfo.uid = ''
  props.userInfo.name = ''
  accountPH.value = t('login.mobile.input.account_placeholder')
  passwordPH.value = t('login.mobile.input.code_placeholder')
  arrowStatus.value = false
}

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
}

watch(
  () => loginHistories.value.length,
  (len) => {
    if (len === 0) {
      arrowStatus.value = false
    }
  }
)

watch(
  () => props.activeTab,
  (newTab) => {
    if (newTab === 'register') {
      resetLoginForm()
    }
  }
)

onMounted(() => {
  window.addEventListener('click', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';
</style>
