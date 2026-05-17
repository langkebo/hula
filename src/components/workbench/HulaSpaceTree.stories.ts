import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, ref } from 'vue'
import { createSidebarFrameStyle } from '~/.storybook/harness'
import HulaSpaceTree from './HulaSpaceTree.vue'

type StorySpaceNode = {
  spaceId: string
  name: string
  childCount: number
  memberCount: number
  avatarUrl?: string
}

const storyFrameStyle = createSidebarFrameStyle(520)

const treePages: Record<string, { initial: StorySpaceNode[]; more?: StorySpaceNode[] }> = {
  '!space-root:example.com': {
    initial: [
      { spaceId: '!space-design:example.com', name: 'Design', childCount: 2, memberCount: 18 },
      { spaceId: '!space-growth:example.com', name: 'Growth', childCount: 0, memberCount: 9 }
    ],
    more: [{ spaceId: '!space-archive:example.com', name: 'Archive', childCount: 0, memberCount: 4 }]
  },
  '!space-design:example.com': {
    initial: [
      { spaceId: '!space-icon:example.com', name: 'Icon System', childCount: 0, memberCount: 6 },
      { spaceId: '!space-motion:example.com', name: 'Motion', childCount: 0, memberCount: 5 }
    ]
  }
}

const loader = async ({
  spaceId,
  from
}: {
  spaceId: string
  from?: string
}): Promise<{ rooms: StorySpaceNode[]; next_batch?: string }> => {
  const page = treePages[spaceId]
  if (!page) {
    return { rooms: [] }
  }

  if (from === 'page-2') {
    return { rooms: page.more ?? [] }
  }

  return {
    rooms: page.initial,
    next_batch: page.more?.length ? 'page-2' : undefined
  }
}

const meta = {
  title: 'Components/Workbench/HulaSpaceTree',
  component: HulaSpaceTree,
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    spaceId: '!space-root:example.com',
    selectedSpaceId: '!space-design:example.com',
    loader
  },
  render: (args) =>
    defineComponent({
      components: { HulaSpaceTree },
      setup() {
        const selectedSpaceId = ref(args.selectedSpaceId)
        return {
          args,
          selectedSpaceId,
          storyFrameStyle
        }
      },
      template: `
        <div :style="storyFrameStyle">
          <div style="padding: 12px; border-bottom: 1px solid var(--hula-border-default); font-size: 12px; color: var(--hula-text-tertiary);">
            Breadcrumb: Root / {{ selectedSpaceId || 'none' }}
          </div>
          <div style="padding: 8px;">
            <HulaSpaceTree
              v-bind="args"
              :selected-space-id="selectedSpaceId"
              @select="selectedSpaceId = $event.spaceId" />
          </div>
        </div>
      `
    })
} satisfies Meta<typeof HulaSpaceTree>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TreeLoadMore: Story = {}

export const Breadcrumb: Story = {
  args: {
    selectedSpaceId: '!space-motion:example.com'
  }
}
