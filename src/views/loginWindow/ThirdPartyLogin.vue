<template>
  <div class="flex-x-center gap-28px mt-12px">
    <div
      v-for="item in ssoOptions"
      :key="item.key"
      role="button"
      tabindex="0"
      :title="item.label"
      :aria-label="item.label"
      :aria-disabled="ssoDisabled"
      :disabled="ssoDisabled"
      @click="item.action()"
      @keydown.enter="item.action()">
      <n-tooltip trigger="hover" :delay="200">
        <template #trigger>
          <div class="size-22px flex-center cursor-pointer rounded-4px" :class="item.style">
            <svg v-if="item.icon.startsWith('#')" class="size-22px">
              <use :href="item.icon"></use>
            </svg>
            <span v-else class="text-14px font-bold">{{ item.icon }}</span>
          </div>
        </template>
        {{ item.label }}
      </n-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useLoginFlow } from '@/composables/user/useLoginFlow'

const { showFeedback } = useActionFeedback()

export type ThirdPartyLoginContext = Pick<ReturnType<typeof useLoginFlow>, 'loading' | 'loginDisabled'> & {
  giteeLogin?: () => void
  githubLogin?: () => void
  homeserverUrl?: Ref<string>
  identityServerUrl?: Ref<string>
}

const props = withDefaults(
  defineProps<{
    extraDisabled?: boolean
    loginContext?: ThirdPartyLoginContext
  }>(),
  {
    extraDisabled: false
  }
)

const { t } = useI18n()

const defaultContext = useLoginFlow()
const resolvedContext: ThirdPartyLoginContext & ReturnType<typeof useLoginFlow> = props.loginContext
  ? { ...defaultContext, ...props.loginContext }
  : defaultContext

const ssoDisabled = computed(
  () => resolvedContext.loading.value || resolvedContext.loginDisabled.value || props.extraDisabled
)

const noop = () => {
  showFeedback(t('login.sso.unavailable_feature'), 'info')
}

// 企业 SSO（OIDC/SAML/CAS）入口已下线，仅保留 Gitee/GitHub 第三方登录
const ssoOptions = computed(() => [
  {
    key: 'gitee',
    label: t('login.third_party.gitee'),
    icon: '#gitee-login',
    style: 'color-[--tjg-color-danger-500] dark:color-[--tjg-color-danger-500]80',
    action: resolvedContext.giteeLogin || noop
  },
  {
    key: 'github',
    label: t('login.third_party.github'),
    icon: '#github-login',
    style: 'text-[--tjg-text-primary]',
    action: resolvedContext.githubLogin || noop
  }
])
</script>
