import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import TjgSpaceTree from '../TjgSpaceTree.vue'

const { getHierarchyMock } = vi.hoisted(() => ({
  getHierarchyMock: vi.fn()
}))

vi.mock('naive-ui', () => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NSpin: passthrough('NSpin'),
    NEmpty: passthrough('NEmpty'),
    NAvatar: passthrough('NAvatar'),
    NTag: passthrough('NTag'),
    NButton: defineComponent({
      name: 'NButton',
      setup(_, { slots }) {
        return () => h('button', { type: 'button', 'data-test': 'NButton' }, slots.default?.())
      }
    })
  }
})

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/composables/space', () => ({
  useSpace: (spaceId: () => string) => ({
    getHierarchy: (options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }) =>
      getHierarchyMock(spaceId(), options)
  })
}))

describe('TjgSpaceTree', () => {
  beforeEach(() => {
    getHierarchyMock.mockReset()
    getHierarchyMock.mockImplementation(async (spaceId: string) => {
      if (spaceId === 'space-root') {
        return {
          rooms: [
            { spaceId: 'space-a', name: 'Alpha Space', childCount: 1, memberCount: 3 },
            { spaceId: 'space-b', name: 'Beta Space', childCount: 0, memberCount: 1 }
          ]
        }
      }

      if (spaceId === 'space-a') {
        return {
          rooms: [{ spaceId: 'space-a-child', name: 'Nested Space', childCount: 0, memberCount: 1 }]
        }
      }

      return { rooms: [] }
    })
  })

  it('renders tree semantics for the root level', async () => {
    const wrapper = mount(TjgSpaceTree, {
      props: {
        spaceId: 'space-root'
      }
    })

    await flushPromises()

    const tree = wrapper.get('[role="tree"]')
    const items = wrapper.findAll('[role="treeitem"]')

    expect(tree.attributes('aria-label')).toBe('space.space_tree_label')
    expect(items).toHaveLength(2)
    expect(items[0]?.attributes('data-id')).toBe('space-a')
    expect(items[0]?.attributes('aria-level')).toBe('1')
    expect(items[0]?.attributes('aria-posinset')).toBe('1')
    expect(items[0]?.attributes('aria-setsize')).toBe('2')
  })

  it('supports keyboard selection and expand semantics', async () => {
    const wrapper = mount(TjgSpaceTree, {
      props: {
        spaceId: 'space-root'
      }
    })

    await flushPromises()

    const items = wrapper.findAll('[role="treeitem"]')
    await items[0]!.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ spaceId: 'space-a' })

    await items[0]!.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()

    expect(wrapper.find('[role="group"]').exists()).toBe(true)
  })

  it('passes suggestedOnly through root and nested hierarchy loads', async () => {
    const wrapper = mount(TjgSpaceTree, {
      props: {
        spaceId: 'space-root',
        suggestedOnly: true
      }
    })

    await flushPromises()

    expect(getHierarchyMock).toHaveBeenCalledWith(
      'space-root',
      expect.objectContaining({
        suggestedOnly: true
      })
    )

    const items = wrapper.findAll('[role="treeitem"]')
    await items[0]!.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()

    expect(getHierarchyMock).toHaveBeenCalledWith(
      'space-a',
      expect.objectContaining({
        suggestedOnly: true
      })
    )
  })
})
