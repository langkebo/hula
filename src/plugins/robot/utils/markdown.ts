import type { DefineComponent } from 'vue'
import { renderWorker } from '@/services/renderWorker'

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
      props: ['node', 'isDark', 'darkTheme', 'lightTheme'],
      setup(props, { attrs, slots }) {
        const highlightedHtml = ref('')
        const isLoading = ref(true)

        watch(
          () => [props.node.code, props.node.language, props.isDark],
          async () => {
            isLoading.value = true
            try {
              const theme = props.isDark ? props.darkTheme : props.lightTheme
              const { html } = await renderWorker.execute<
                { code: string; language: string; theme: string },
                { html: string }
              >('highlight-code', {
                code: props.node.code,
                language: props.node.language,
                theme: theme || (props.isDark ? 'vitesse-dark' : 'vitesse-light')
              })
              highlightedHtml.value = html
            } catch (_error) {
              highlightedHtml.value = `<pre><code>${props.node.code}</code></pre>`
            } finally {
              isLoading.value = false
            }
          },
          { immediate: true }
        )

        return () =>
          h(
            MarkdownCodeBlockNodeComponent,
            {
              ...(attrs as Partial<MarkdownCodeBlockNodeProps>),
              ...toolbarOverrides,
              node: {
                ...props.node,
                // 如果已经有高亮结果，则传入渲染
                code: highlightedHtml.value || props.node.code
              },
              loading: isLoading.value
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
