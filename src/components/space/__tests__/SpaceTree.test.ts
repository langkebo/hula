import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { SpaceTreeNode } from '../SpaceTree.vue'
import SpaceTree from '../SpaceTree.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

const leafNode: SpaceTreeNode = {
  spaceId: '!leaf:server',
  name: 'Leaf Space',
  childCount: 0,
  memberCount: 3
}

const parentNode: SpaceTreeNode = {
  spaceId: '!parent:server',
  name: 'Parent Space',
  childCount: 2,
  memberCount: 10,
  children: [
    {
      spaceId: '!child-a:server',
      name: 'Child A',
      childCount: 1,
      memberCount: 4,
      rooms: [{ roomId: '!room-a1:server', name: 'Room A1' }]
    },
    leafNode
  ],
  rooms: [{ roomId: '!room-parent:server', name: 'Parent Room' }]
}

const mountTree = (props: Record<string, unknown> = {}) =>
  mount(SpaceTree, {
    props: {
      spaces: [parentNode],
      ...props
    }
  })

describe('SpaceTree', () => {
  it('renders the tree container with role=tree', () => {
    const wrapper = mountTree()
    expect(wrapper.find('[role="tree"]').exists()).toBe(true)
  })

  it('renders top-level space nodes as treeitems', () => {
    const wrapper = mountTree()
    const items = wrapper.findAll('[role="treeitem"]')
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('Parent Space')
  })

  it('shows collapse toggle for nodes with children', () => {
    const wrapper = mountTree()
    const toggle = wrapper.find('[data-testid="space-tree-toggle-!parent:server"]')
    expect(toggle.exists()).toBe(true)
  })

  it('does not show toggle for nodes without children or rooms', () => {
    const wrapper = mountTree({ spaces: [{ ...leafNode, childCount: 0 }] })
    const toggle = wrapper.find('[data-testid="space-tree-toggle-!leaf:server"]')
    expect(toggle.exists()).toBe(false)
  })

  it('expands child nodes by default (not collapsed)', () => {
    const wrapper = mountTree()
    expect(wrapper.text()).toContain('Child A')
  })

  it('does not render children when node id is in collapsedIds', () => {
    const wrapper = mountTree({ collapsedIds: ['!parent:server'] })
    expect(wrapper.text()).not.toContain('Child A')
  })

  it('sets aria-expanded=false when collapsed', () => {
    const wrapper = mountTree({ collapsedIds: ['!parent:server'] })
    const item = wrapper.find('[data-testid="space-tree-toggle-!parent:server"]')
    expect(item.attributes('aria-expanded')).toBe('false')
  })

  it('sets aria-expanded=true when expanded', () => {
    const wrapper = mountTree()
    const item = wrapper.find('[data-testid="space-tree-toggle-!parent:server"]')
    expect(item.attributes('aria-expanded')).toBe('true')
  })

  it('emits toggle with spaceId when toggle button clicked', async () => {
    const wrapper = mountTree()
    await wrapper.find('[data-testid="space-tree-toggle-!parent:server"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([['!parent:server']])
  })

  it('emits select with spaceId when node row clicked', async () => {
    const wrapper = mountTree()
    await wrapper.find('[data-testid="space-tree-node-!parent:server"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['!parent:server']])
  })

  it('highlights selected node', () => {
    const wrapper = mountTree({ selectedSpaceId: '!parent:server' })
    const node = wrapper.find('[data-testid="space-tree-node-!parent:server"]')
    expect(node.classes()).toContain('space-tree__node--selected')
  })

  it('renders avatar image when avatarUrl provided', () => {
    const wrapper = mountTree({
      spaces: [{ ...leafNode, avatarUrl: 'https://example.com/a.png' }]
    })
    const img = wrapper.find('[data-testid="space-tree-avatar-img-!leaf:server"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
  })

  it('renders avatar placeholder (initials) when no avatarUrl', () => {
    const wrapper = mountTree({ spaces: [leafNode] })
    const placeholder = wrapper.find('[data-testid="space-tree-avatar-placeholder-!leaf:server"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toBe('L')
  })

  it('renders child count badge with total direct items', () => {
    const wrapper = mountTree()
    // parent: 2 children + 1 room = 3 direct items
    const count = wrapper.find('[data-testid="space-tree-count-!parent:server"]')
    expect(count.exists()).toBe(true)
    expect(count.text()).toBe('3')
  })

  it('recursively renders nested children', () => {
    const wrapper = mountTree()
    expect(wrapper.text()).toContain('Child A')
    expect(wrapper.text()).toContain('Leaf Space')
  })

  it('emits select on Enter keypress', async () => {
    const wrapper = mountTree()
    await wrapper.find('[data-testid="space-tree-node-!parent:server"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toEqual([['!parent:server']])
  })

  it('emits toggle on ArrowRight when collapsed', async () => {
    const wrapper = mountTree({ collapsedIds: ['!parent:server'] })
    await wrapper.find('[data-testid="space-tree-node-!parent:server"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('toggle')).toEqual([['!parent:server']])
  })

  it('emits toggle on ArrowLeft when expanded', async () => {
    const wrapper = mountTree()
    await wrapper.find('[data-testid="space-tree-node-!parent:server"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('toggle')).toEqual([['!parent:server']])
  })

  it('does not emit toggle on ArrowLeft when already collapsed', async () => {
    const wrapper = mountTree({ collapsedIds: ['!parent:server'] })
    await wrapper.find('[data-testid="space-tree-node-!parent:server"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })

  it('renders empty hint when spaces list is empty', () => {
    const wrapper = mountTree({ spaces: [] })
    expect(wrapper.find('[data-testid="space-tree-empty"]').exists()).toBe(true)
  })

  it('uses 1.5px stroke width on toggle svg', () => {
    const wrapper = mountTree()
    const svg = wrapper.find('[data-testid="space-tree-toggle-!parent:server"] svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('stroke-width')).toBe('1.5')
  })
})
