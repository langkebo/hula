import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { RoomTypeEnum } from '@/enums'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useGlobalStore } from '@/stores/domains/widget/global'
import MsgInput from './MsgInput.vue'

const meta = {
  title: 'Components/RightBox/MsgInput',
  component: MsgInput,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div style="padding: 20px; background: var(--hula-surface-canvas); min-height: 200px; display: flex; flex-direction: column;"><story /></div>'
    })
  ]
} satisfies Meta<typeof MsgInput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 模拟 ChatFooter 的状态遮罩层
 */
const StateOverlayWrapper = defineComponent({
  components: { MsgInput },
  props: {
    state: {
      type: String as () =>
        | 'normal'
        | 'readonly'
        | 'tombstoned'
        | 'no-permission'
        | 'invited'
        | 'not-friend'
        | 'preparing',
      default: 'normal'
    }
  },
  setup(props) {
    const { t } = useI18n()
    const globalStore = useGlobalStore()
    const sessionStore = useSessionStore()
    const footerHeight = 150

    // 设置模拟数据以确保 MsgInput 渲染
    const mockRoomId = '!room:overlay-test'
    sessionStore.addSession({
      roomId: mockRoomId,
      name: 'Overlay Test Room',
      type: RoomTypeEnum.GROUP,
      activeTime: Date.now(),
      unreadCount: 0
    } as any)
    globalStore.currentSessionRoomId = mockRoomId

    const overlayContent = computed(() => {
      switch (props.state) {
        case 'readonly':
          return { icon: '#lock', text: t('editor.room_readonly') || '该房间为只读模式' }
        case 'tombstoned':
          return { icon: '#lock', text: '该房间已迁移，无法发送消息' }
        case 'no-permission':
          return { icon: '#lock', text: '您没有在该房间发送消息的权限' }
        case 'invited':
          return { icon: '#lock', text: '接受邀请后即可参与对话' }
        case 'not-friend':
          return { icon: '#cloudError', text: t('editor.relation.not_friends') || '你们还不是好友' }
        case 'preparing':
          return { icon: '', text: t('editor.preparing_session') || '正在准备会话...' }
        default:
          return null
      }
    })

    return { overlayContent, footerHeight, t }
  },
  template: `
    <div class="relative flex flex-col w-full h-full border-t border-[--hula-border-default]">
      <!-- 状态遮罩层 (模拟 ChatFooter 逻辑) -->
      <div
        v-if="overlayContent"
        :style="{ height: footerHeight + 'px' }"
        class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto bg-[--hula-surface-overlay]"
      >
        <div class="flex flex-col items-center justify-center pb-20px">
          <svg v-if="overlayContent.icon" class="size-24px mb-8px text-[--hula-text-tertiary]">
            <use :href="overlayContent.icon"></use>
          </svg>
          <span class="text-(14px [--hula-text-tertiary])">{{ overlayContent.text }}</span>
        </div>
      </div>

      <!-- 输入框主体 -->
      <div class="flex flex-col flex-1 min-h-0">
        <div class="flex-shrink-0 px-22px py-10px flex items-center gap-18px opacity-50 pointer-events-none">
          <svg class="size-18px"><use href="#smiling-face"></use></svg>
          <svg class="size-18px"><use href="#screenshot"></use></svg>
          <svg class="size-18px"><use href="#file2"></use></svg>
        </div>
        <div class="pl-20px flex flex-1 min-h-0">
          <MsgInput />
        </div>
      </div>
    </div>
  `
})

export const Default: Story = {
  render: () => ({
    components: { MsgInput },
    setup() {
      const globalStore = useGlobalStore()
      const sessionStore = useSessionStore()

      // 设置模拟数据
      const mockRoomId = '!room:example.com'
      sessionStore.addSession({
        roomId: mockRoomId,
        name: 'Test Room',
        type: RoomTypeEnum.GROUP,
        activeTime: Date.now(),
        unreadCount: 0
      } as any)
      globalStore.currentSessionRoomId = mockRoomId

      return {}
    },
    template: '<MsgInput />'
  })
}

export const Readonly: Story = {
  render: () => ({
    components: { StateOverlayWrapper },
    template: '<StateOverlayWrapper state="readonly" />'
  })
}

export const Tombstoned: Story = {
  render: () => ({
    components: { StateOverlayWrapper },
    template: '<StateOverlayWrapper state="tombstoned" />'
  })
}

export const NoPermission: Story = {
  render: () => ({
    components: { StateOverlayWrapper },
    template: '<StateOverlayWrapper state="no-permission" />'
  })
}

export const Invited: Story = {
  render: () => ({
    components: { StateOverlayWrapper },
    template: '<StateOverlayWrapper state="invited" />'
  })
}

export const NotFriend: Story = {
  render: () => ({
    components: { StateOverlayWrapper },
    template: '<StateOverlayWrapper state="not-friend" />'
  })
}

export const Preparing: Story = {
  render: () => ({
    components: { StateOverlayWrapper },
    template: '<StateOverlayWrapper state="preparing" />'
  })
}
