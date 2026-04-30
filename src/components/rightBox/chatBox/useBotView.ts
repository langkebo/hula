import { invoke } from '@tauri-apps/api/core'
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { Webview } from '@tauri-apps/api/webview'
import { getCurrentWindow, type Window as TauriWindow } from '@tauri-apps/api/window'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import DOMPurify from 'dompurify'
import type { DropdownOption } from 'naive-ui'
import { computed, nextTick, type Ref, ref, shallowRef, watch } from 'vue'
import { type AssistantModelPreset, useAssistantModelPresets } from '@/hooks/useAssistantModelPresets'
import { useBotStore } from '@/stores/domains/user/bot'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'

const logger = createLogger('Bot')

type ViewState =
  | { type: 'readme' }
  | { type: 'markdown'; source: string }
  | { type: 'web'; url: string }
  | { type: 'assistant' }

const cloneView = (view: ViewState): ViewState => {
  if (view.type === 'readme' || view.type === 'assistant') {
    return { type: view.type }
  }
  if (view.type === 'markdown') {
    return { type: 'markdown', source: view.source }
  }
  return { type: 'web', url: view.url }
}

interface UseBotViewOptions {
  startLoading: () => void
  finishLoading: () => void
  errorLoading: () => void
}

export const useBotView = ({ startLoading, finishLoading, errorLoading }: UseBotViewOptions) => {
  const botStore = useBotStore()

  const currentLang = ref<'zh' | 'en'>('zh')
  const renderedMarkdown = ref('')
  const isViewingLink = ref(false)
  const currentUrl = ref('')

  const markdownContainer = ref<HTMLElement | null>(null)
  const webviewContainer = ref<HTMLElement | null>(null)

  const currentView = ref<ViewState>({ type: 'readme' })
  const historyStack = ref<ViewState[]>([])
  const canGoBack = computed(() => historyStack.value.length > 0)
  const isAssistantView = computed(() => currentView.value.type === 'assistant')

  const customModelPath = ref<string | null>(null)
  const selectedModelKey = ref<string | null>(null)
  const canImportLocalModel = isDesktop()
  const showAssistantMinimalToolbar = computed(() => canImportLocalModel && isAssistantView.value)
  let assistantFallbackView: ViewState | null = null
  let assistantShouldPopHistoryOnError = false

  const { presets: assistantModelPresets, fetchAssistantModelPresets } = useAssistantModelPresets()
  void fetchAssistantModelPresets()

  const externalWebview = shallowRef<Webview | null>(null)
  const webviewLabel = 'bot-inline-browser'
  const webviewListeners: UnlistenFn[] = []
  let containerResizeObserver: ResizeObserver | null = null
  let hostWindow: TauriWindow | null = null

  const canEmbedWebview = computed(() => {
    if (typeof window === 'undefined') return false
    return isDesktop() && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  })

  const sanitizeMarkdown = (html: string, options?: { trustContent?: boolean }) => {
    if (options?.trustContent ?? true) {
      return html
    }
    return DOMPurify.sanitize(html, {
      ADD_ATTR: ['style', 'align', 'width', 'height', 'cellpadding', 'cellspacing', 'border']
    })
  }

  const findPresetByKey = (key: string | null | undefined): AssistantModelPreset | undefined => {
    if (!key) return void 0
    return assistantModelPresets.value.find((preset) => preset.modelKey === key)
  }

  const formatPresetLabel = (preset: AssistantModelPreset) => {
    if (!preset.version || preset.modelName.includes(preset.version)) {
      return preset.modelName
    }
    return `${preset.modelName} (${preset.version})`
  }

  const assistantModelDropdownOptions = computed<DropdownOption[]>(() =>
    assistantModelPresets.value.map((preset) => ({
      key: preset.modelKey,
      label: formatPresetLabel(preset),
      extra: preset.description ?? (preset.version ? `版本 ${preset.version}` : void 0)
    }))
  )

  const selectedModelLabel = computed(() => {
    if (selectedModelKey.value === 'local') {
      return '本地模型'
    }
    const preset = findPresetByKey(selectedModelKey.value)
    if (preset) {
      return formatPresetLabel(preset)
    }
    const first = assistantModelPresets.value[0]
    return first ? formatPresetLabel(first) : '选择模型'
  })

  const applyFirstPreset = (options?: { force?: boolean }) => {
    const firstPreset = assistantModelPresets.value[0]
    if (!firstPreset) {
      if (options?.force && selectedModelKey.value !== 'local') {
        selectedModelKey.value = null
        customModelPath.value = null
      }
      return
    }
    if (!options?.force && selectedModelKey.value === 'local') {
      return
    }
    selectedModelKey.value = firstPreset.modelKey
    customModelPath.value = firstPreset.modelUrl
  }

  watch(
    assistantModelPresets,
    (presets) => {
      if (!presets.length) {
        if (selectedModelKey.value !== 'local') {
          selectedModelKey.value = null
          customModelPath.value = null
        }
        return
      }
      if (selectedModelKey.value === 'local') {
        return
      }
      const current = presets.find((preset) => preset.modelKey === selectedModelKey.value)
      if (current) {
        customModelPath.value = current.modelUrl
      } else {
        applyFirstPreset({ force: true })
      }
    },
    { immediate: true }
  )

  const pushCurrentView = () => {
    historyStack.value.push(cloneView(currentView.value))
  }

  const ensureHostWindow = async () => {
    if (!canEmbedWebview.value) return null
    if (!hostWindow) {
      hostWindow = getCurrentWindow()
    }
    return hostWindow
  }

  const clearWebviewListeners = () => {
    while (webviewListeners.length) {
      try {
        const unsubscribe = webviewListeners.pop()
        unsubscribe?.()
      } catch (error) {
        logger.warn('取消 webview 监听失败:', error)
      }
    }
  }

  const updateExternalWebviewBounds = async () => {
    if (!externalWebview.value || !webviewContainer.value) return
    const rect = webviewContainer.value.getBoundingClientRect()
    try {
      await externalWebview.value.setPosition(new LogicalPosition(rect.left, rect.top))
      await externalWebview.value.setSize(new LogicalSize(rect.width, rect.height))
    } catch (error) {
      logger.warn('更新嵌入 Webview 尺寸失败:', error)
    }
  }

  const destroyExternalWebview = async () => {
    clearWebviewListeners()
    if (containerResizeObserver && webviewContainer.value) {
      containerResizeObserver.unobserve(webviewContainer.value)
      containerResizeObserver.disconnect()
      containerResizeObserver = null
    }
    window.removeEventListener('resize', updateExternalWebviewBounds)
    if (externalWebview.value) {
      try {
        await externalWebview.value.close()
      } catch (error) {
        logger.warn('关闭嵌入 Webview 失败:', error)
      }
      externalWebview.value = null
    }
  }

  const handleAssistantReady = () => {
    assistantFallbackView = null
    assistantShouldPopHistoryOnError = false
  }

  const handleAssistantError = async (error: unknown) => {
    logger.error('加载 HuLa 小管家失败:', error)
    customModelPath.value = null
    selectedModelKey.value = null
    applyFirstPreset({ force: true })
    if (assistantShouldPopHistoryOnError && historyStack.value.length) {
      historyStack.value.pop()
    }
    assistantShouldPopHistoryOnError = false
    const fallback = assistantFallbackView
    assistantFallbackView = null
    if (!fallback) return
    if (fallback.type === 'readme') {
      await loadReadme(false)
    } else if (fallback.type === 'markdown') {
      await loadMarkdownFile(fallback.source, false)
    } else if (fallback.type === 'web') {
      await showExternalLink(fallback.url, false)
    }
  }

  const showAssistant = async (recordHistory = true, preserveCustomModel = false) => {
    await fetchAssistantModelPresets(assistantModelPresets.value.length <= 1)
    if (currentView.value.type === 'assistant') {
      botStore.setAssistant('正在预览模型')
      if (preserveCustomModel) {
        await nextTick()
      }
      return
    }
    if (!preserveCustomModel) {
      applyFirstPreset({ force: true })
    }
    assistantFallbackView = cloneView(currentView.value)
    assistantShouldPopHistoryOnError = recordHistory
    if (recordHistory) {
      pushCurrentView()
    }
    await destroyExternalWebview()
    isViewingLink.value = false
    currentUrl.value = ''
    currentView.value = { type: 'assistant' }
    botStore.setAssistant('正在预览模型')
    await nextTick()
  }

  const openLocalModel = async () => {
    try {
      const selected = await open({
        filters: [{ name: '3D Models', extensions: ['glb', 'gltf', 'vrm'] }],
        multiple: false
      })
      if (!selected) return
      customModelPath.value = Array.isArray(selected) ? selected[0] : selected
      selectedModelKey.value = 'local'
      await showAssistant(true, true)
    } catch (error) {
      logger.error('选择本地模型失败:', error)
      window.$message?.error('选择模型文件失败，请重试')
    }
  }

  const handlePresetModelSelect = async (key: string) => {
    const preset = findPresetByKey(key)
    if (!preset) return
    const targetModelPath = preset.modelUrl
    if (selectedModelKey.value === key && targetModelPath === customModelPath.value) {
      if (currentView.value.type !== 'assistant') {
        await showAssistant(true, true)
      }
      return
    }
    selectedModelKey.value = key
    customModelPath.value = targetModelPath
    await showAssistant(true, true)
  }

  const createExternalWebview = async (url: string) => {
    const windowInstance = await ensureHostWindow()
    if (!windowInstance || !webviewContainer.value) return

    try {
      const existing = await Webview.getByLabel(webviewLabel)
      await existing?.close()
    } catch {
      // ignore
    }

    await destroyExternalWebview()
    const rect = webviewContainer.value.getBoundingClientRect()
    const newWebview = new Webview(windowInstance, webviewLabel, {
      url,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      focus: true,
      dragDropEnabled: true
    })

    externalWebview.value = newWebview
    containerResizeObserver = new ResizeObserver(() => {
      updateExternalWebviewBounds()
    })
    containerResizeObserver.observe(webviewContainer.value)
    window.addEventListener('resize', updateExternalWebviewBounds, { passive: true })

    const createdListener = await newWebview.once('tauri://created', async () => {
      await updateExternalWebviewBounds()
      botStore.setWeb(url)
      finishLoading()
    })
    const errorListener = await newWebview.once('tauri://error', async (error) => {
      logger.error('嵌入 Webview 创建失败:', error)
      errorLoading()
      await destroyExternalWebview()
      isViewingLink.value = false
      currentUrl.value = ''
      try {
        await openUrl(url)
      } catch (openError) {
        logger.error('在浏览器中打开失败:', openError)
      }
    })
    webviewListeners.push(createdListener, errorListener)
  }

  const showExternalLink = async (url: string, recordHistory = true) => {
    const previousView = currentView.value
    if (recordHistory) {
      pushCurrentView()
    }
    currentUrl.value = url
    isViewingLink.value = true
    currentView.value = { type: 'web', url }

    startLoading()
    await nextTick()

    if (!canEmbedWebview.value) {
      finishLoading()
      botStore.setWeb(url)
      try {
        await openUrl(url)
      } catch (error) {
        logger.error('在浏览器中打开失败:', error)
        errorLoading()
      }
      return
    }

    try {
      await createExternalWebview(url)
    } catch (error) {
      logger.error('创建嵌入 Webview 失败:', error)
      errorLoading()
      if (recordHistory) {
        historyStack.value.pop()
      }
      await destroyExternalWebview()
      if (previousView.type === 'markdown') {
        await loadMarkdownFile(previousView.source, false)
      } else {
        await loadReadme(false)
      }
    }
  }

  const removeLinkListeners = () => {
    if (!markdownContainer.value) return
    markdownContainer.value.removeEventListener('click', handleLinkClick, true)
  }

  const attachLinkListeners = () => {
    if (!markdownContainer.value) return
    removeLinkListeners()
    markdownContainer.value.addEventListener('click', handleLinkClick, true)
    logger.debug('已附加链接监听器')
  }

  const handleLinkClick = async (event: Event) => {
    let target = event.target as HTMLElement
    while (target && target.tagName !== 'A') {
      target = target.parentElement as HTMLElement
    }
    if (!target || target.tagName !== 'A') return

    const href = (target as HTMLAnchorElement).getAttribute('href')
    if (!href) return

    event.preventDefault()
    event.stopPropagation()

    logger.debug('点击链接:', href)

    if (href.startsWith('#')) {
      const id = href.substring(1)
      const element = markdownContainer.value?.querySelector(`#${id}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else if (href.endsWith('.md')) {
      await loadMarkdownFile(href, true)
    } else {
      await showExternalLink(href)
    }
  }

  const loadReadme = async (recordHistory = false, resetHistory = false) => {
    startLoading()
    try {
      if (recordHistory) {
        pushCurrentView()
      }
      if (resetHistory) {
        historyStack.value = []
      }
      await destroyExternalWebview()
      const html = await invoke<string>('get_readme_html', { language: currentLang.value })
      renderedMarkdown.value = sanitizeMarkdown(html)
      currentView.value = { type: 'readme' }
      isViewingLink.value = false
      currentUrl.value = ''

      await nextTick()
      attachLinkListeners()
      finishLoading()
      botStore.setReadme(currentLang.value)
    } catch (error) {
      logger.error('加载 README 失败:', error)
      renderedMarkdown.value = '<p>加载失败,请稍后重试</p>'
      if (recordHistory) {
        historyStack.value.pop()
      }
      errorLoading()
    }
  }

  const loadMarkdownFile = async (filePath: string, recordHistory = true) => {
    startLoading()
    try {
      if (recordHistory) {
        pushCurrentView()
      }
      await destroyExternalWebview()
      const html = await invoke<string>('parse_markdown', { filePath })
      renderedMarkdown.value = sanitizeMarkdown(html)
      isViewingLink.value = false
      currentView.value = { type: 'markdown', source: filePath }
      currentUrl.value = ''

      await nextTick()
      attachLinkListeners()
      finishLoading()
      botStore.setMarkdown(filePath)
    } catch (error) {
      logger.error('加载 markdown 文件失败:', error)
      renderedMarkdown.value = `<p>加载文件失败: ${filePath}</p><p>错误: ${error}</p>`
      if (recordHistory) {
        historyStack.value.pop()
      }
      errorLoading()
    }
  }

  const openInBrowser = async () => {
    if (!currentUrl.value) return
    try {
      await openUrl(currentUrl.value)
    } catch (error) {
      logger.error('在浏览器中打开失败:', error)
    }
  }

  const goBack = async () => {
    if (!historyStack.value.length) return
    const previous = historyStack.value.pop()
    if (!previous) return

    if (previous.type === 'readme') {
      await loadReadme(false)
    } else if (previous.type === 'markdown') {
      await loadMarkdownFile(previous.source, false)
    } else if (previous.type === 'assistant') {
      await showAssistant(false)
    } else {
      await showExternalLink(previous.url, false)
    }
  }

  const switchLanguage = (lang: 'zh' | 'en') => {
    currentLang.value = lang
  }

  watch(currentLang, () => {
    loadReadme(false, true)
  })

  watch(isViewingLink, async (newValue) => {
    if (!newValue) {
      await nextTick()
      attachLinkListeners()
    } else {
      await nextTick()
      updateExternalWebviewBounds()
    }
  })

  const initialize = () => {
    Webview.getByLabel(webviewLabel)
      .then((webview) => webview?.close())
      .catch(() => {})

    window.addEventListener('beforeunload', destroyExternalWebview)
    loadReadme(false, true)
  }

  const cleanup = () => {
    removeLinkListeners()
    void destroyExternalWebview()
    window.removeEventListener('beforeunload', destroyExternalWebview)
  }

  return {
    currentLang,
    renderedMarkdown,
    isViewingLink,
    currentUrl,
    markdownContainer: markdownContainer as Ref<HTMLElement | null>,
    webviewContainer: webviewContainer as Ref<HTMLElement | null>,
    canGoBack,
    isAssistantView,
    customModelPath,
    selectedModelKey,
    canImportLocalModel,
    showAssistantMinimalToolbar,
    assistantModelDropdownOptions,
    selectedModelLabel,
    canEmbedWebview,
    handleAssistantReady,
    handleAssistantError,
    showAssistant,
    openLocalModel,
    handlePresetModelSelect,
    showExternalLink,
    openInBrowser,
    loadReadme,
    loadMarkdownFile,
    goBack,
    switchLanguage,
    initialize,
    cleanup
  }
}
