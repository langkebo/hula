import { computed } from 'vue'
import { describe, expect, it } from 'vitest'
import { createDefaultDynamicRoadmap, getDynamicRoadmapItem, getDynamicStatusText, useDynamic } from '../useDynamic'

describe('useDynamic', () => {
  it('provides a reusable roadmap skeleton', () => {
    const roadmap = createDefaultDynamicRoadmap()

    expect(roadmap.map((item) => item.id)).toEqual(['feed', 'publisher', 'detail', 'mobile-entry'])
  })

  it('resolves detail items by shared id', () => {
    expect(getDynamicRoadmapItem('detail')).toEqual(expect.objectContaining({ id: 'detail', status: 'in-progress' }))
    expect(getDynamicRoadmapItem('missing')).toBeNull()
  })

  it('maps status values to shared labels', () => {
    expect(getDynamicStatusText('planned')).toBe('待规划')
    expect(getDynamicStatusText('in-progress')).toBe('建设中')
    expect(getDynamicStatusText('blocked')).toBe('待接入')
  })

  it('falls back to the shared detail card when route id is absent', () => {
    const state = useDynamic(computed(() => undefined))

    expect(state.selectedItem.value.id).toBe('detail')
    expect(state.hasMobileEntry.value).toBe(true)
    expect(state.summary.value).toContain('主导航')
  })
})
