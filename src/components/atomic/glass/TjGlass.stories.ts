/**
 * TjGlass 视觉回归基线（docs/UI优化方案-v2.4.md §10 阶段 E2）
 *
 * 覆盖 4 个 variant × 明暗主题，共 8 张基线：
 * - 舞台底色用 `--tjg-glass-aurora-*` 氛围层，确保模糊有可折射的内容；
 * - 明暗切换沿用生产环境的 `html[data-theme]`，而不是给组件传主题 prop；
 * - 所有颜色/尺寸均来自 design-tokens，story 内不写字面量。
 */
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { h, onUnmounted } from 'vue'
import TjGlass from './TjGlass.vue'

type GlassVariant = 'panel' | 'subtle' | 'row' | 'none'
type StoryTheme = 'light' | 'dark'

const stageStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '360px',
  height: '220px',
  padding: '32px',
  boxSizing: 'border-box',
  backgroundColor: 'var(--tjg-surface-panel)',
  backgroundImage: 'var(--tjg-glass-aurora-a), var(--tjg-glass-aurora-b), var(--tjg-glass-aurora-c)'
}

const contentStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minWidth: '220px',
  padding: '20px 24px',
  color: 'var(--tjg-text-primary)',
  fontSize: 'var(--tjg-font-size-base)'
}

const meta: Meta<typeof TjGlass> = {
  title: 'Atomic/TjGlass',
  component: TjGlass,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['panel', 'subtle', 'row', 'none']
    },
    engine: { control: 'select', options: ['auto', 'off'] },
    tone: { control: 'select', options: [undefined, 'nav', 'tabbar', 'input', 'sheet', 'row'] },
    radius: { control: 'select', options: ['surface', 'panel', 'sheet', 'full'] }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/** 生成一个 variant × theme 的基线 story */
function createStory(variant: GlassVariant, theme: StoryTheme): Story {
  return {
    render: () => ({
      components: { TjGlass },
      setup() {
        document.documentElement.dataset.theme = theme
        onUnmounted(() => {
          delete document.documentElement.dataset.theme
        })

        const glassProps = variant === 'row' ? { variant, tone: 'row' as const } : { variant }

        return () =>
          h('div', { style: stageStyle }, [
            h(TjGlass, glassProps, () =>
              h('div', { style: contentStyle }, [
                h('strong', { style: { fontSize: 'var(--tjg-font-size-lg)' } }, `variant="${variant}"`),
                h('span', null, theme === 'light' ? 'Light theme baseline' : 'Dark theme baseline'),
                h('span', null, '玻璃材质只由 TjGlass 提供')
              ])
            )
          ])
      }
    })
  }
}

export const PanelLight: Story = createStory('panel', 'light')
export const PanelDark: Story = createStory('panel', 'dark')
export const SubtleLight: Story = createStory('subtle', 'light')
export const SubtleDark: Story = createStory('subtle', 'dark')
export const RowLight: Story = createStory('row', 'light')
export const RowDark: Story = createStory('row', 'dark')
export const NoneLight: Story = createStory('none', 'light')
export const NoneDark: Story = createStory('none', 'dark')
