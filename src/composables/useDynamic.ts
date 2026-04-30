import { computed, type MaybeRefOrGetter, toValue } from 'vue'

export type DynamicRoadmapStatus = 'planned' | 'in-progress' | 'blocked'

export interface DynamicRoadmapItem {
  id: string
  title: string
  description: string
  status: DynamicRoadmapStatus
}

const defaultRoadmap: DynamicRoadmapItem[] = [
  {
    id: 'feed',
    title: '动态流',
    description: '统一承接内容流、刷新与分页状态，作为桌面与移动动态首页的共享入口。',
    status: 'planned'
  },
  {
    id: 'publisher',
    title: '发布能力',
    description: '统一处理发文、图片选择与草稿状态，避免双端重复维护交互状态。',
    status: 'planned'
  },
  {
    id: 'detail',
    title: '动态详情',
    description: '统一详情读取、评论区状态与上下文返回逻辑，给桌面/移动详情页复用。',
    status: 'in-progress'
  },
  {
    id: 'mobile-entry',
    title: '移动端入口',
    description: '移动端已通过主导航正式接入动态页，预览卡片与临时跳转入口已移除。',
    status: 'in-progress'
  }
]

export function createDefaultDynamicRoadmap(): DynamicRoadmapItem[] {
  return defaultRoadmap.map((item) => ({ ...item }))
}

export function getDynamicStatusText(status: DynamicRoadmapStatus): string {
  if (status === 'in-progress') return '建设中'
  if (status === 'blocked') return '待接入'
  return '待规划'
}

export function getDynamicRoadmapItem(id?: string | null): DynamicRoadmapItem | null {
  if (!id) return null
  return createDefaultDynamicRoadmap().find((item) => item.id === id) ?? null
}

export function useDynamic(detailId?: MaybeRefOrGetter<string | undefined>) {
  const roadmap = computed(() => createDefaultDynamicRoadmap())
  const selectedDetailId = computed(() => toValue(detailId))
  const selectedItem = computed(() => getDynamicRoadmapItem(selectedDetailId.value) ?? roadmap.value[2])

  const summary = computed(
    () => 'Dynamic 已接入桌面与移动端共享骨架，移动端现通过主导航正式进入，后续继续统一首页、详情、评论与发布流程。'
  )
  const hasMobileEntry = computed(() =>
    roadmap.value.some((item) => item.id === 'mobile-entry' && item.status !== 'blocked')
  )

  return {
    roadmap,
    selectedItem,
    summary,
    hasMobileEntry,
    getStatusText: getDynamicStatusText
  }
}
