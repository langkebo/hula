<template>
  <div class="widget-container" :class="{ fullscreen: isFullscreen }">
    <div class="widget-header">
      <div class="widget-title">
        <n-icon size="18">
          <Icon :icon="getWidgetIcon(widget.type)" />
        </n-icon>
        <span>{{ widget.name || widget.id }}</span>
      </div>
      <div class="widget-controls">
        <n-button text size="small" @click="handleRefresh">
          <template #icon>
            <n-icon><Icon icon="mdi:refresh" /></n-icon>
          </template>
        </n-button>
        <n-button text size="small" @click="toggleFullscreen">
          <template #icon>
            <n-icon>
              <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
            </n-icon>
          </template>
        </n-button>
        <n-button text size="small" @click="handleClose">
          <template #icon>
            <n-icon><Icon icon="mdi:close" /></n-icon>
          </template>
        </n-button>
      </div>
    </div>
    <div class="widget-content">
      <div v-if="sessionLoading" class="widget-loading">
        <n-spin size="medium" />
      </div>
      <iframe
        v-else
        ref="iframeRef"
        :src="iframeUrl"
        :title="widget.name || widget.id"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
        allow="microphone; camera; display-capture"
        @load="handleLoad" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useWidgets, type Widget } from '@/composables/widget'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WidgetContainer')

const { createWidgetSession, terminateWidgetSession } = useWidgets(() => props.roomId)

const props = defineProps<{
  widget: Widget
  roomId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const isFullscreen = ref(false)
const isLoaded = ref(false)
const sessionLoading = ref(true)
const sessionId = ref<string | null>(null)
const sessionToken = ref<string | null>(null)

const iframeUrl = computed(() => buildIframeUrl(props.widget.url, sessionId.value, sessionToken.value))

function buildIframeUrl(baseUrl: string, sid: string | null, token: string | null): string {
  if (!sid && !token) return baseUrl
  try {
    const url = new URL(baseUrl)
    if (sid) url.searchParams.set('widgetSessionId', sid)
    if (token) url.searchParams.set('widgetAccessToken', token)
    return url.toString()
  } catch {
    return baseUrl
  }
}

const initSession = async () => {
  sessionLoading.value = true
  try {
    const response = (await createWidgetSession(props.widget.id, undefined, false)) as {
      session_id?: string
      sessionId?: string
      access_token?: string
      accessToken?: string
    } | null
    if (response) {
      sessionId.value = response.session_id ?? response.sessionId ?? null
      sessionToken.value = response.access_token ?? response.accessToken ?? null
      logger.info('[WidgetContainer] 会话已创建:', props.widget.id, sessionId.value)
    } else {
      logger.warn('[WidgetContainer] createWidgetSession 返回空响应，使用裸 URL 加载 widget')
    }
  } catch (error) {
    logger.error('[WidgetContainer] createWidgetSession 失败，使用裸 URL 加载:', error)
  } finally {
    sessionLoading.value = false
  }
}

const terminateSession = async () => {
  const sid = sessionId.value
  if (!sid) return
  try {
    await terminateWidgetSession(sid, false)
    logger.info('[WidgetContainer] 会话已终止:', sid)
  } catch (error) {
    logger.warn('[WidgetContainer] 终止会话失败:', error)
  } finally {
    sessionId.value = null
    sessionToken.value = null
  }
}

const getWidgetIcon = (type: string) => {
  const icons: Record<string, string> = {
    jitsi: 'mdi:video',
    etherpad: 'mdi:file-document-edit',
    poll: 'mdi:poll',
    custom: 'mdi:puzzle'
  }
  return icons[type] || 'mdi:puzzle'
}

const handleLoad = () => {
  isLoaded.value = true
  logger.info('[WidgetContainer] Widget 加载完成:', props.widget.id)
}

const handleRefresh = async () => {
  await terminateSession()
  await initSession()
  if (iframeRef.value) {
    iframeRef.value.src = iframeUrl.value
  }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

const handleClose = () => {
  emit('close')
}

const handleMessage = (event: MessageEvent) => {
  if (!iframeRef.value || event.source !== iframeRef.value.contentWindow) {
    return
  }

  logger.info('[WidgetContainer] 收到 Widget 消息:', event.data)

  if (event.data && typeof event.data === 'object') {
    const { action } = event.data

    switch (action) {
      case 'close':
        handleClose()
        break
      case 'fullscreen':
        isFullscreen.value = true
        break
      case 'exit_fullscreen':
        isFullscreen.value = false
        break
      default:
        logger.warn('[WidgetContainer] 未知的 Widget 消息:', action)
    }
  }
}

onMounted(() => {
  window.addEventListener('message', handleMessage)
  initSession()
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
  terminateSession()
})
</script>

<style scoped lang="scss">
.widget-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hula-surface-app);
  border-radius: 8px;
  overflow: hidden;

  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    border-radius: 0;
  }
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--hula-border-default);

  .widget-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;

    .n-icon {
      color: var(--color-primary);
    }
  }

  .widget-controls {
    display: flex;
    gap: 4px;
  }
}

.widget-content {
  flex: 1;
  position: relative;
  overflow: hidden;

  .widget-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
}
</style>
