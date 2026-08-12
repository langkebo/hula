import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import RoomMembershipTabs from './RoomMembershipTabs.vue'

const meta: Meta<typeof RoomMembershipTabs> = {
  title: 'Room/RoomMembershipTabs',
  component: RoomMembershipTabs,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    modelValue: { control: 'select', options: ['all', 'joined', 'created'] },
    joinedCount: { control: 'number' },
    createdCount: { control: 'number' }
  }
}

export default meta
type Story = StoryObj<typeof RoomMembershipTabs>

export const Default: Story = {
  render: () => ({
    components: { RoomMembershipTabs },
    setup() {
      const value = ref('all')
      return { value }
    },
    template: '<RoomMembershipTabs v-model="value" :joined-count="12" :created-count="3" />'
  })
}

export const JoinedTab: Story = {
  render: () => ({
    components: { RoomMembershipTabs },
    setup() {
      const value = ref('joined')
      return { value }
    },
    template: '<RoomMembershipTabs v-model="value" :joined-count="25" :created-count="0" />'
  })
}

export const CreatedTab: Story = {
  render: () => ({
    components: { RoomMembershipTabs },
    setup() {
      const value = ref('created')
      return { value }
    },
    template: '<RoomMembershipTabs v-model="value" :joined-count="8" :created-count="5" />'
  })
}

export const NoCounts: Story = {
  render: () => ({
    components: { RoomMembershipTabs },
    setup() {
      const value = ref('all')
      return { value }
    },
    template: '<RoomMembershipTabs v-model="value" />'
  })
}
