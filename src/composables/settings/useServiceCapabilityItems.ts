import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlatform } from '@/composables/usePlatform'
import { type CapabilityProbeResult, canProbeCapability, probeCapabilities } from '@/services/matrix/capabilityProbe'
import {
  type CapabilityStatus,
  type TjgCapability,
  useServerCapability
} from '@/services/matrix/MatrixCapabilityService'
import { type SettingsTabType, useSettingsTabStore } from '@/stores/domains/settings/settingsTab'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import type { CapabilityItem, CapabilityState } from '@/types/capability'

/** 诊断面板展示的能力位，顺序即渲染顺序 */
const DIAGNOSTIC_CAPABILITIES: TjgCapability[] = [
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
/**
 * 「服务端宣告」与「路由实体」冲突时的提示（纯函数，便于判据覆盖）。
 *
 * 两种冲突才是探测的价值所在，一致时不额外提示：
 * · 宣告缺失但路由存在 → 能力被误藏（多半是后端登记了路由没更新 `/versions`）
 * · 宣告存在但路由 404 → 假入口（版本回滚 / 模块未启用 / 宣告与实现脱节）
 */
export function resolveProbeHint(
  status: CapabilityStatus,
  probe: CapabilityProbeResult | undefined,
  t: (key: string) => string
): string | undefined {
  if (!probe) return undefined
  if (status === 'unsupported' && probe.outcome === 'route-present') {
    return t('common.capability.hint.probeDeclaredMissing')
  }
  if (status === 'supported' && probe.outcome === 'route-missing') {
    return t('common.capability.hint.probeDeclaredButMissing')
  }
  return undefined
}

export function useServiceCapabilityItems() {
  const { t } = useI18n()
  const { isDesktop } = usePlatform()
  const { getCapabilityStatus, getCapabilityAliases, refreshCapabilities } = useServerCapability()
  const settingsTab = useSettingsTabStore()

  const capabilities = computed(() => DIAGNOSTIC_CAPABILITIES.filter((key) => isDesktop || key !== 'admin-api'))

  /** 有对应设置页签的能力位；面板只为这些条目渲染「设置」入口 */
  const settingsKeys = computed(() => capabilities.value.filter((key) => SETTINGS_TAB_BY_CAPABILITY[key] !== undefined))

  const userStore = useUserStore()
  const globalStore = useGlobalStore()
  /** 路由面探测结果（READ-ONLY 证据，不参与 getCapabilityStatus 判定） */
  const probeResults = ref<Partial<Record<TjgCapability, CapabilityProbeResult>>>({})

  const items = computed<CapabilityItem[]>(() =>
    capabilities.value.map((key) => {
      const status = getCapabilityStatus(key)
      const state: CapabilityState =
        status === 'supported' ? 'ready' : status === 'unknown' ? 'degraded' : 'unavailable'
      const probeHint = resolveProbeHint(status, probeResults.value[key], t)
      const baseHint = resolveHint(key, status)
      return {
        key,
        label: t(`common.capability.items.${key}`),
        state,
        hint: [baseHint, probeHint].filter(Boolean).join(' · ')
      }
    })
  )

  /**
   * 探测可探测能力位的路由实体（诊断面板打开时调用）。
   * 只影响提示文案，不改判定；失败一律 inconclusive，不污染能力位状态。
   */
  async function probeRouting(): Promise<void> {
    const targets = capabilities.value.filter((key) => canProbeCapability(key))
    if (targets.length === 0) return
    const results = await probeCapabilities(targets, {
      userId: userStore.userInfo?.uid ?? undefined,
      roomId: globalStore.currentSessionRoomId ?? undefined
    })
    probeResults.value = { ...probeResults.value, ...results }
  }

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

  return { items, settingsKeys, refresh, openSettings, probeRouting, probeResults }
}
