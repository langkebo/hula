<template>
  <div class="flex-center cursor-default gap-12px text-12px color-[--color-text-tertiary]">
    <span class="h-px w-60px bg-#dadada dark:bg-#3a3a3a"></span>
    <span>{{ ssoLabel }}</span>
    <span class="h-px w-60px bg-#dadada dark:bg-#3a3a3a"></span>
  </div>
  <div class="flex-x-center gap-28px mt-16px">
    <div
      v-for="item in ssoOptions"
      :key="item.key"
      :title="item.label"
      :aria-label="item.label"
      :disabled="ssoDisabled"
      @click="item.action()">
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
import { resolveMatrixEndpointConfig } from '@/services/backend'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ThirdPartyLogin')
import { useLoginFlow } from '@/hooks/useLoginFlow'
import { matrixOidcService } from '@/services/matrix/auth/MatrixOidcService'

export type ThirdPartyLoginContext = Pick<ReturnType<typeof useLoginFlow>, 'loading' | 'loginDisabled'> & {
  giteeLogin?: () => void
  githubLogin?: () => void
  homeserverUrl?: Ref<string>
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

const thirdPartyLabel = computed(() => t('login.third_party.title'))
const ssoLabel = computed(() => t('login.sso.title') || 'SSO 登录')

const noop = () => {
  window.$message?.info('第三方登录功能暂未开放，请使用账号密码登录')
}

const ssoDisabled = computed(
  () => resolvedContext.loading.value || resolvedContext.loginDisabled.value || props.extraDisabled
)

const getHomeserverUrl = (): string => {
  try {
    const configuredHomeserverUrl = resolvedContext.homeserverUrl?.value?.trim()
    if (configuredHomeserverUrl) {
      return configuredHomeserverUrl
    }
  } catch (e) {
    logger.warn('Failed to get homeserver URL:', e)
  }

  return resolveMatrixEndpointConfig().homeserverUrl
}

const handleOidcLogin = async () => {
  try {
    const homeserverUrl = getHomeserverUrl()
    const discovery = await matrixOidcService.discoverOidc(homeserverUrl)

    if (!discovery) {
      window.$message?.error('OIDC 登录不可用，请检查服务器配置')
      return
    }

    const redirectUri = `${window.location.origin}/oidc/callback`
    const authUrl = await matrixOidcService.getAuthorizationUrl({ redirectUri })

    if (authUrl) {
      window.location.href = authUrl
    } else {
      window.$message?.error('获取 OIDC 授权 URL 失败')
    }
  } catch (error) {
    logger.error('OIDC login error:', error)
    window.$message?.error('OIDC 登录失败')
  }
}

const handleSamlLogin = () => {
  const homeserverUrl = getHomeserverUrl()
  const redirectUri = encodeURIComponent(window.location.origin)
  const samlUrl = `${homeserverUrl}/_matrix/client/r0/login/sso/redirect/saml?redirectUrl=${redirectUri}`
  window.location.href = samlUrl
}

const handleCasLogin = () => {
  const homeserverUrl = getHomeserverUrl()
  const redirectUri = encodeURIComponent(window.location.origin)
  const casUrl = `${homeserverUrl}/cas/login?service=${redirectUri}`
  window.location.href = casUrl
}

const ssoOptions = computed(() => [
  {
    key: 'oidc',
    label: t('login.sso.oidc') || 'OIDC 单点登录',
    icon: 'OIDC',
    style: 'color-[--color-primary] dark:color-[--color-primary]80',
    action: handleOidcLogin
  },
  {
    key: 'saml',
    label: t('login.sso.saml') || 'SAML 单点登录',
    icon: 'SAML',
    style: 'color-#303030 dark:color-#fefefe90',
    action: handleSamlLogin
  },
  {
    key: 'cas',
    label: t('login.sso.cas') || 'CAS 单点登录',
    icon: 'CAS',
    style: 'color-[--color-danger] dark:color-[--color-danger]80',
    action: handleCasLogin
  },
  {
    key: 'gitee',
    label: t('login.third_party.gitee'),
    icon: '#gitee-login',
    style: 'color-[--color-danger] dark:color-[--color-danger]80',
    action: resolvedContext.giteeLogin || noop
  },
  {
    key: 'github',
    label: t('login.third_party.github'),
    icon: '#github-login',
    style: 'color-#303030 dark:color-#fefefe90',
    action: resolvedContext.githubLogin || noop
  }
])
</script>
