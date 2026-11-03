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
import { useLoginFlow } from '@/shared/composables/useLoginFlow'

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
    /** 仅桌面端 CAS 能力探测通过时由登录页传入 */
    casEnabled?: boolean
    casLogin?: () => void
  }>(),
  {
    extraDisabled: false,
    casEnabled: false
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

// 第三方入口：Gitee/GitHub 常驻；CAS 仅在服务端支持且桌面端具备 Tauri 运行时后渲染
const ssoOptions = computed(() => {
  const options = [
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
  ]
  if (props.casEnabled) {
    options.push({
      key: 'cas',
      label: t('login.cas.label'),
      icon: '#cas-login',
      style: 'text-[--tjg-text-primary]',
      action: props.casLogin || noop
    })
  }
  return options
})
</script>
