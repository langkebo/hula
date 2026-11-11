import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { type DynamicRoadmapStatus, useDynamic } from '@/composables/useDynamic'
import { completeRenderSampleOnNextFrame, startRenderSample } from '@/utils/AppHarness'

type DynamicStatusTagType = 'primary' | 'warning' | 'default'

export interface UseDynamicDetailOptions {
  /** 渲染采样名：桌面与移动分开统计，便于分别观察首屏耗时。 */
  sampleName: string
  /** 详情页路由前缀，例如 `/dynamic`。 */
  routePrefix: string
}

/**
 * 动态状态到标签配色（桌面自定义样式 / 移动 Vant tag 共用同一映射）。
 */
export function getDynamicStatusTagType(status: DynamicRoadmapStatus): DynamicStatusTagType {
  if (status === 'in-progress') return 'primary'
  if (status === 'blocked') return 'warning'
  return 'default'
}

/**
 * 动态详情页共享逻辑：路由 id 解析、详情状态读取、渲染采样。
 *
 * 桌面 `plugins/dynamic/detail.vue` 只保留自己的模板与样式，状态与采样口径统一在这里维护。
 * （移动端同名详情页与其路由已于 2026-11-11 删除：无入口、且是空间页的复制品。）
 */
export function useDynamicDetail({ sampleName, routePrefix }: UseDynamicDetailOptions) {
  const route = useRoute()
  const detailId = computed(() => String(route.params.id || route.query.id || 'detail'))
  const { selectedItem, getStatusText } = useDynamic(detailId)

  const sampleRoute = () => `${routePrefix}/${detailId.value}`

  startRenderSample(sampleName, {
    route: sampleRoute(),
    meta: {
      source: 'page-entry'
    }
  })

  onMounted(() => {
    completeRenderSampleOnNextFrame(sampleName, {
      route: sampleRoute()
    })
  })

  return {
    detailId,
    selectedItem,
    getStatusText,
    getTagType: getDynamicStatusTagType
  }
}
