import type { Meta, StoryObj } from '@storybook/vue3-vite'
// 卡片依赖 Vant 图标字体与 --van-* 变量；不引入时图标空白、封面底色丢失，
// 视觉基线与真实移动端不一致。
import 'vant/es/icon/style/index.mjs'
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import SpaceCard from './SpaceCard.vue'

const baseSpace: SpaceInfo = {
  spaceId: '!space-ux:example.com',
  name: 'UX 设计协作空间',
  topic: '设计系统、组件规范与走查记录',
  memberCount: 128,
  childCount: 12
}

// 内联 data URI：story 不依赖外网图片，离线也能稳定回归
const coverImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%233b82f6'/%3E%3C/svg%3E"

const meta = {
  title: 'Mobile/Space/SpaceCard',
  component: SpaceCard,
  parameters: {
    layout: 'centered'
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="width: 320px"><story /></div>'
    })
  ],
  args: {
    space: baseSpace
  }
} satisfies Meta<typeof SpaceCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    space: { ...baseSpace, avatarUrl: coverImage }
  }
}

export const DefaultCover: Story = {
  args: {
    space: { ...baseSpace, spaceId: '!space-empty:example.com', name: '新建空间', topic: undefined }
  }
}

export const LongTopic: Story = {
  args: {
    space: {
      ...baseSpace,
      avatarUrl: coverImage,
      name: '跨端体验治理与设计令牌落地的长期专项空间',
      topic:
        '汇总桌面端与移动端的设计令牌、组件体积红线、动效降级与可访问性走查结论，确保每次迭代都能回溯到具体页面与验收命令。',
      memberCount: 2048,
      childCount: 156
    }
  }
}
