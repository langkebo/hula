import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS
} from '@/router/spaceNavigation'
import { createSidebarFrameStyle } from '~/.storybook/harness'
import RoomSpaceToolbar from './RoomSpaceToolbar.vue'

const frameStyle = `${createSidebarFrameStyle(720)}; width: 100%;`

const meta: Meta<typeof RoomSpaceToolbar> = {
  title: 'Components/Workbench/RoomSpaceToolbar',
  component: RoomSpaceToolbar,
  parameters: {
    layout: 'fullscreen'
  },
  render: (args) => ({
    components: { RoomSpaceToolbar },
    setup() {
      return {
        args,
        frameStyle
      }
    },
    template: `
      <div :style="frameStyle">
        <RoomSpaceToolbar v-bind="args" />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    searchKeyword: '',
    sessionTypeFilter: WORKBENCH_SESSION_TYPE_FILTERS.all,
    sessionEngagementFilter: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all,
    sessionSort: WORKBENCH_SESSION_SORTS.recent,
    filteredCount: 18,
    totalCount: 42
  }
}

export const FilterSummary: Story = {
  args: {
    ...Default.args,
    searchKeyword: 'alice',
    sessionTypeFilter: WORKBENCH_SESSION_TYPE_FILTERS.group,
    sessionEngagementFilter: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.unread,
    sessionSort: WORKBENCH_SESSION_SORTS.name,
    filteredCount: 3,
    totalCount: 42
  }
}

export const SavedPreset: Story = {
  args: {
    ...FilterSummary.args,
    hasSavedPreset: true,
    savedPresetApplied: true
  }
}
