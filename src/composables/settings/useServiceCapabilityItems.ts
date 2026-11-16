import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlatform } from '@/composables/usePlatform'
import {
  type CapabilityStatus,
  type TjgCapability,
  useServerCapability
} from '@/services/matrix/MatrixCapabilityService'
import { type SettingsTabType, useSettingsTabStore } from '@/stores/domains/settings/settingsTab'
import type { CapabilityItem, CapabilityState } from '@/types/capability'

/** 诊断面板展示的能力位，顺序即渲染顺序 */
export const DIAGNOSTIC_CAPABILITIES: TjgCapability[] = [
  'sliding-sync',
  'e2ee',
  'voip',
  'friend-list',
  'admin-api',
  'burn-after-read',
  'dehydrated-device',
  'sticky-events',
  'scheduled-send',
  'rtc-transports',
  'account-status',
  'extended-profile',
  'qr-rendezvous',
  'mutual-rooms'
]

/** 能力位对应的设置页签，用于诊断面板的「设置」跳转；未列出的能力位不提供跳转 */
const SETTINGS_TAB_BY_CAPABILITY: Partial<Record<TjgCapability, SettingsTabType>> = {
  e2ee: 'encryption',
  'dehydrated-device': 'encryption',
  voip: 'voiceVideo',
  'rtc-transports': 'voiceVideo',
  'burn-after-read': 'burnAfterRead',
  'friend-list': 'friends',
  'admin-api': 'mjolnir',
  'extended-profile': 'account',
  'account-status': 'account'
}

/**
 * 服务能力诊断数据源：把能力三态映射为面板条目，并提供重试与设置跳转。
 * 判定与请求均由 MatrixCapabilityService 负责，这里只做展示层组装。
 */
export function useServiceCapabilityItems() {
  const { t } = useI18n()
  const { isDesktop } = usePlatform()
  const { getCapabilityStatus, getCapabilityAliases, refreshCapabilities } = useServerCapability()
  const settingsTab = useSettingsTabStore()

  const capabilities = computed(() => DIAGNOSTIC_CAPABILITIES.filter((key) => isDesktop || key !== 'admin-api'))

  /** 有对应设置页签的能力位；面板只为这些条目渲染「设置」入口 */
  const settingsKeys = computed(() => capabilities.value.filter((key) => SETTINGS_TAB_BY_CAPABILITY[key] !== undefined))

  const items = computed<CapabilityItem[]>(() =>
    capabilities.value.map((key) => {
      const status = getCapabilityStatus(key)
      const state: CapabilityState =
        status === 'supported' ? 'ready' : status === 'unknown' ? 'degraded' : 'unavailable'
      return {
        key,
        label: t(`common.capability.items.${key}`),
        state,
        hint: resolveHint(key, status) ?? ''
      }
    })
  )

  function resolveHint(key: TjgCapability, status: CapabilityStatus): string | undefined {
    if (status === 'supported') return undefined
    if (status === 'unknown') return t('common.capability.hint.unknown')
    const aliases = getCapabilityAliases(key)
    const declaredKeys = [...aliases.unstable, ...aliases.capabilities]
    if (declaredKeys.length === 0) return t('common.capability.hint.unsupported_client')
    return t('common.capability.hint.unsupported', { keys: declaredKeys.join(' / ') })
  }

  async function refresh(): Promise<void> {
    await refreshCapabilities()
  }

  function openSettings(key: string): void {
    const tab = SETTINGS_TAB_BY_CAPABILITY[key as TjgCapability]
    if (!tab || !isDesktop) return
    settingsTab.setActiveTab(tab)
  }

  return { items, settingsKeys, refresh, openSettings }
}
