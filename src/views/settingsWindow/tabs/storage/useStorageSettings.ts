import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { applyMediaUploadPreferences } from '@/services/matrix/media/mediaUploadPreferences'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { formatBytes } from '@/utils/Formatting'

type QuotaState = 'loading' | 'available' | 'unavailable'
type MediaConfigState = 'loading' | 'available' | 'unavailable'

/**
 * StorageSettings 的数据编排：浏览器存储用量、服务端媒体配额/告警、媒体服务配置与上传策略。
 * 组件只保留模板与本地样式。
 */
export function useStorageSettings() {
  const { t } = useI18n()

  const usage = ref(0)
  const quota = ref(0)

  const quotaState = ref<QuotaState>('loading')
  const quotaUsed = ref(0)
  const quotaLimit = ref(0)
  const quotaRemaining = ref(0)
  const quotaMediaCount = ref(0)
  const quotaAlerts = ref<
    Extract<Awaited<ReturnType<typeof matrixMediaService.getQuotaAlerts>>, { ok: true }>['alerts']
  >([])

  const quotaExceeded = computed(() => quotaLimit.value > 0 && quotaRemaining.value <= 0)

  /** 告警类型标签：避免把原始 snake_case 值直接暴露给用户。 */
  function alertTypeLabel(type: 'quota_warning' | 'quota_exceeded'): string {
    const key =
      type === 'quota_exceeded'
        ? 'setting.storage.quota_alert_type_exceeded'
        : 'setting.storage.quota_alert_type_warning'
    return t(key)
  }

  /** 告警时间：后端 `created_ts` 为毫秒时间戳。 */
  function formatAlertTime(createdTs: number): string {
    return createdTs > 0 ? new Date(createdTs).toLocaleString() : '—'
  }

  const mediaConfigState = ref<MediaConfigState>('loading')
  const maxUploadSize = ref(0)
  const authenticatedMedia = ref(false)

  /**
   * 局部读取失败标记。
   *
   * 配额统计 / 告警 / 认证媒体开关是三个相互独立的接口，任一失败目前会退化成
   * 「0 项」「暂无告警」「未启用」，把读取失败谎报成确定值。这里单独记录失败，
   * 由页面顶部 partial 态说明数据缺失并提供重试。
   */
  const quotaStatsFailed = ref(false)
  const quotaAlertsFailed = ref(false)
  const mediaAuthFailed = ref(false)
  const partialFailures = computed(
    () => Number(quotaStatsFailed.value) + Number(quotaAlertsFailed.value) + Number(mediaAuthFailed.value)
  )

  const settingStore = useSettingStore()
  const { uploadCompressEnabled, uploadCompressQuality, uploadChunkEnabled } = storeToRefs(settingStore)

  const qualityOptions = computed(() => [
    { label: t('setting.storage.quality_small'), value: 0.6 },
    { label: t('setting.storage.quality_standard'), value: 0.8 },
    { label: t('setting.storage.quality_high'), value: 0.9 }
  ])

  async function loadMediaConfig(): Promise<void> {
    mediaConfigState.value = 'loading'
    mediaAuthFailed.value = false
    // 上传上限与认证媒体开关各自独立降级：认证配置读取失败不影响上传上限展示。
    const [configResult, authResult] = await Promise.allSettled([
      matrixMediaService.getMediaConfig(),
      matrixMediaService.getAuthenticatedMediaConfig()
    ])

    if (configResult.status === 'fulfilled' && configResult.value) {
      maxUploadSize.value = Number(configResult.value['m.upload.size'] ?? 0)
      mediaConfigState.value = 'available'
    } else {
      mediaConfigState.value = 'unavailable'
    }

    mediaAuthFailed.value = authResult.status === 'rejected'
    authenticatedMedia.value = authResult.status === 'fulfilled' && Boolean(authResult.value?.authenticated_media)
  }

  function updateCompressEnabled(value: boolean): void {
    settingStore.setUploadCompressEnabled(value)
    applyMediaUploadPreferences()
  }

  function updateCompressQuality(value: number): void {
    settingStore.setUploadCompressQuality(value === 0.6 || value === 0.9 ? value : 0.8)
    applyMediaUploadPreferences()
  }

  function updateChunkEnabled(value: boolean): void {
    settingStore.setUploadChunkEnabled(value)
    applyMediaUploadPreferences()
  }

  async function loadStats(): Promise<void> {
    // ⚠️ 这里曾展示「SDK store 缓存命中率 / 内存占用」并调用矩阵 worker 的 getStats()。
    // Batch 3.2 取证确认该消息在 worker 侧恒返回 null（worker 从不持有 client）⇒ 六个统计项
    // 永远显示 `-`。已移除该段假数据；浏览器存储用量是真实数据，保留。
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usage.value = estimate.usage ?? 0
      quota.value = estimate.quota ?? 0
    }
  }

  async function loadQuota(): Promise<void> {
    quotaState.value = 'loading'
    quotaStatsFailed.value = false
    quotaAlertsFailed.value = false
    // 三个接口各自独立降级：任一失败不阻断其余数据展示。
    const [usageResult, statsResult, alertsResult] = await Promise.allSettled([
      matrixMediaService.checkQuota(),
      matrixMediaService.getQuotaStats(),
      matrixMediaService.getQuotaAlerts()
    ])

    if (usageResult.status === 'rejected' || !usageResult.value) {
      quotaState.value = 'unavailable'
      return
    }

    quotaUsed.value = usageResult.value.used
    quotaLimit.value = usageResult.value.limit
    quotaRemaining.value = usageResult.value.remaining

    if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
      quotaMediaCount.value = statsResult.value.stats.mediaCount
    } else {
      quotaStatsFailed.value = true
      quotaMediaCount.value = 0
    }

    // 告警接口不再把失败折叠成空数组：`ok: false` 与「真的没有告警」必须分开。
    const alertsOutcome = alertsResult.status === 'fulfilled' ? alertsResult.value : null
    quotaAlertsFailed.value = alertsOutcome?.ok !== true
    quotaAlerts.value = alertsOutcome?.ok ? alertsOutcome.alerts : []
    quotaState.value = 'available'
  }

  /** partial 态的重试只补读失败的子资源，不触碰压缩 / 分片等本地偏好 */
  function retryPartialLoads(): void {
    void Promise.all([loadQuota(), loadMediaConfig()])
  }

  onMounted(() => {
    void loadStats()
    void loadQuota()
    void loadMediaConfig()
  })

  return {
    usage,
    quota,
    quotaState,
    quotaUsed,
    quotaLimit,
    quotaRemaining,
    quotaMediaCount,
    quotaAlerts,
    quotaExceeded,
    alertTypeLabel,
    formatAlertTime,
    mediaConfigState,
    maxUploadSize,
    authenticatedMedia,
    quotaStatsFailed,
    mediaAuthFailed,
    partialFailures,
    uploadCompressEnabled,
    uploadCompressQuality,
    uploadChunkEnabled,
    qualityOptions,
    updateCompressEnabled,
    updateCompressQuality,
    updateChunkEnabled,
    retryPartialLoads,
    formatBytes
  }
}
