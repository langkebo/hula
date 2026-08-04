import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, onBeforeUnmount, onMounted } from 'vue'
import { useAriaLive } from '@/composables/common/useAriaLive'
import GlobalAriaLive from './GlobalAriaLive.vue'

const meta = {
  title: 'Components/Common/GlobalAriaLive',
  component: GlobalAriaLive,
  parameters: {
    layout: 'centered',
    controls: { disable: true }
  }
} satisfies Meta<typeof GlobalAriaLive>

export default meta
type Story = StoryObj<typeof meta>

const render: Story['render'] = () =>
  defineComponent({
    components: { GlobalAriaLive },
    setup() {
      const { announce, clearAnnouncements } = useAriaLive()

      const announcePolite = () => {
        announce('已完成筛选条件更新，结果列表已刷新。', 'polite')
      }

      const announceAssertive = () => {
        announce('邀请成员失败，请检查权限后重试。', 'assertive')
      }

      onMounted(() => {
        clearAnnouncements()
      })

      onBeforeUnmount(() => {
        clearAnnouncements()
      })

      return {
        announcePolite,
        announceAssertive
      }
    },
    template: `
      <div style="width: 420px; display: grid; gap: 12px;">
        <GlobalAriaLive />
        <p style="margin: 0; font-size: 14px; color: var(--tjg-text-secondary);">
          使用下方按钮模拟 polite / assertive 异步播报，便于在 Storybook 中人工验证 live region 承载层。
        </p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button type="button" class="demo-btn" @click="announcePolite">触发 polite 播报</button>
          <button type="button" class="demo-btn demo-btn-danger" @click="announceAssertive">触发 assertive 播报</button>
        </div>
      </div>
    `
  })

export const Default: Story = {
  render
}
