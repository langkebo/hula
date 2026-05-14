<template>
  <div class="flex-center cursor-default gap-12px text-12px color-[--hula-text-tertiary]">
    <span class="h-px w-60px bg-[--login-third-party-divider-color]"></span>
    <span>{{ ssoLabel }}</span>
    <span class="h-px w-60px bg-[--login-third-party-divider-color]"></span>
  </div>
  <div class="flex-x-center gap-28px mt-16px">
    <div
      v-for="item in visibleSsoOptions"
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
import { computed, onMounted, type Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  discoverAndSaveMatrixEndpoints,
  resolveMatrixEndpointConfig,
  saveMatrixSessionEndpointConfig
} from '@/services/backend'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ThirdPartyLogin')

import { useLoginFlow } from '@/hooks/useLoginFlow'
import { matrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import { matrixOidcService } from '@/services/matrix/auth/MatrixOidcService'

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

const ssoLabel = computed(() => t('login.sso.title') || 'SSO 登录')

const noop = () => {
  window.$message?.info('第三方登录功能暂未开放，请使用账号密码登录')
}

const ssoDisabled = computed(
  () => resolvedContext.loading.value || resolvedContext.loginDisabled.value || props.extraDisabled
)

const availableFlows = ref<Set<string>>(new Set())
const flowsLoading = ref(false)
const flowsError = ref<string | null>(null)

const SSO_FLOW_MAP: Record<string, string> = {
  oidc: 'm.login.sso',
  saml: 'm.login.sso',
  cas: 'm.login.cas'
}

async function detectAvailableFlows(): Promise<void> {
  flowsLoading.value = true
  flowsError.value = null
  try {
    const flows = await matrixAuthService.getLoginFlows()
    const flowTypes = new Set(flows.map((f) => f.type))
    availableFlows.value = flowTypes
    logger.info('检测到可用登录流:', [...flowTypes])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    flowsError.value = msg
    logger.warn('获取登录流失败，将显示所有SSO选项:', msg)
  } finally {
    flowsLoading.value = false
  }
}

onMounted(() => {
  detectAvailableFlows()
})

function isSsoFlowAvailable(key: string): boolean {
  if (flowsLoading.value || flowsError.value) {
    return true
  }
  const flowType = SSO_FLOW_MAP[key]
  if (!flowType) {
    return true
  }
  if (availableFlows.value.size === 0) {
    return true
  }
  return availableFlows.value.has(flowType)
}

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

const resolveSsoHomeserverUrl = async (): Promise<string> => {
  const configuredHomeserverUrl = getHomeserverUrl()
  const fallbackConfig = resolveMatrixEndpointConfig()
  const discovery = await discoverAndSaveMatrixEndpoints(configuredHomeserverUrl, fallbackConfig)
  saveMatrixSessionEndpointConfig({
    homeserverUrl: discovery.homeserverUrl,
    identityServerUrl: discovery.identityServerUrl
  })

  if (resolvedContext.homeserverUrl) {
    resolvedContext.homeserverUrl.value = discovery.homeserverUrl
  }

  if (resolvedContext.identityServerUrl) {
    resolvedContext.identityServerUrl.value = discovery.identityServerUrl
  }

  return discovery.homeserverUrl
}

const redirectTo = (url: string): void => {
  window.location.assign(url)
}

const handleOidcLogin = async () => {
  if (!isSsoFlowAvailable('oidc')) {
    window.$message?.info('OIDC 单点登录服务暂未配置，请使用账号密码登录')
    return
  }
  try {
    const homeserverUrl = await resolveSsoHomeserverUrl()
    const discovery = await matrixOidcService.discoverOidc(homeserverUrl)

    if (!discovery) {
      window.$message?.error('OIDC 登录不可用，请检查服务器配置')
      return
    }

    const redirectUri = `${window.location.origin}/oidc/callback`
    const authUrl = await matrixOidcService.getAuthorizationUrl({ redirectUri })

    if (authUrl) {
      redirectTo(authUrl)
    } else {
      window.$message?.error('获取 OIDC 授权 URL 失败')
    }
  } catch (error) {
    logger.error('OIDC login error:', error)
    window.$message?.error('OIDC 登录失败')
  }
}

const handleSamlLogin = async () => {
  if (!isSsoFlowAvailable('saml')) {
    window.$message?.info('SAML 单点登录服务暂未配置，请使用账号密码登录')
    return
  }
  try {
    const homeserverUrl = await resolveSsoHomeserverUrl()
    const redirectUri = encodeURIComponent(`${window.location.origin}/login`)
    const samlUrl = `${homeserverUrl}/_matrix/client/r0/login/sso/redirect/saml?redirectUrl=${redirectUri}`
    redirectTo(samlUrl)
  } catch (error) {
    logger.error('SAML login error:', error)
    window.$message?.error('SAML 登录失败')
  }
}

const handleCasLogin = async () => {
  if (!isSsoFlowAvailable('cas')) {
    window.$message?.info('CAS 单点登录服务暂未配置，请使用账号密码登录')
    return
  }
  try {
    const homeserverUrl = await resolveSsoHomeserverUrl()
    const redirectUri = encodeURIComponent(`${window.location.origin}/login`)
    const casUrl = `${homeserverUrl}/cas/login?service=${redirectUri}`
    redirectTo(casUrl)
  } catch (error) {
    logger.error('CAS login error:', error)
    window.$message?.error('CAS 登录失败')
  }
}

const ssoOptions = computed(() => [
  {
    key: 'oidc',
    label: t('login.sso.oidc') || 'OIDC 单点登录',
    icon: 'OIDC',
    style: 'color-[--color-primary] dark:color-[--color-primary]80',
    action: handleOidcLogin,
    available: isSsoFlowAvailable('oidc')
  },
  {
    key: 'saml',
    label: t('login.sso.saml') || 'SAML 单点登录',
    icon: 'SAML',
    style: 'color-#303030 dark:color-#fefefe90',
    action: handleSamlLogin,
    available: isSsoFlowAvailable('saml')
  },
  {
    key: 'cas',
    label: t('login.sso.cas') || 'CAS 单点登录',
    icon: 'CAS',
    style: 'color-[--color-danger] dark:color-[--color-danger]80',
    action: handleCasLogin,
    available: isSsoFlowAvailable('cas')
  },
  {
    key: 'gitee',
    label: t('login.third_party.gitee'),
    icon: '#gitee-login',
    style: 'color-[--color-danger] dark:color-[--color-danger]80',
    action: resolvedContext.giteeLogin || noop,
    available: true
  },
  {
    key: 'github',
    label: t('login.third_party.github'),
    icon: '#github-login',
    style: 'color-#303030 dark:color-#fefefe90',
    action: resolvedContext.githubLogin || noop,
    available: true
  }
])

const visibleSsoOptions = computed(() => ssoOptions.value.filter((item) => item.available))
</script>
