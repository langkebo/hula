import type { DefineComponent } from 'vue'

interface MarkdownCodeBlockNodeData {
  type: 'code_block'
  language: string
  code: string
  raw: string
  diff?: boolean
  originalCode?: string
  updatedCode?: string
}

type MarkdownCodeBlockNodeProps = {
  node: MarkdownCodeBlockNodeData
  loading?: boolean
  stream?: boolean
  darkTheme?: string
  lightTheme?: string
  isDark?: boolean
  isShowPreview?: boolean
  enableFontSizeControl?: boolean
  minWidth?: string | number
  maxWidth?: string | number
  themes?: string[]
  showHeader?: boolean
  showCopyButton?: boolean
  showExpandButton?: boolean
  showPreviewButton?: boolean
  showFontSizeButtons?: boolean
  onCopy?: (...args: unknown[]) => void
  onPreviewCode?: (...args: unknown[]) => void
  [key: string]: unknown
}

export const ROBOT_MARKDOWN_CUSTOM_ID = 'robot-chat-markdown'

let initialized = false
let initPromise: Promise<void> | null = null

const toolbarOverrides = {
  isShowPreview: false,
  showPreviewButton: false,
  enableFontSizeControl: false,
  showFontSizeButtons: false,
  showExpandButton: true,
  showCopyButton: true
} satisfies Partial<MarkdownCodeBlockNodeProps>

export async function initMarkdownRenderer() {
  if (initialized) return
  if (initPromise) {
    await initPromise
    return
  }

  initPromise = (async () => {
    const { MarkdownCodeBlockNode, setCustomComponents } = await import('markstream-vue')
    const MarkdownCodeBlockNodeComponent =
      MarkdownCodeBlockNode as unknown as DefineComponent<MarkdownCodeBlockNodeProps>

    const RobotMarkdownCodeBlockNode = defineComponent({
      name: 'RobotMarkdownCodeBlockNode',
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        return () =>
          h(
            MarkdownCodeBlockNodeComponent,
            {
              ...(attrs as Partial<MarkdownCodeBlockNodeProps>),
              ...toolbarOverrides
            } as MarkdownCodeBlockNodeProps,
            slots
          )
      }
    })

    setCustomComponents(ROBOT_MARKDOWN_CUSTOM_ID, {
      code_block: RobotMarkdownCodeBlockNode
    })

    initialized = true
    initPromise = null
  })()

  await initPromise
}
