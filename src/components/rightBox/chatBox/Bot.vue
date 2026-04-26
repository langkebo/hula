<template>
  <div class="bot-container">
    <!-- 顶部工具栏 -->
    <div class="language-switcher">
      <div v-if="canGoBack" class="back-btn flex-shrink-0" @click="goBack">
        <svg class="rotate-180"><use href="#right"></use></svg>
        返回
      </div>
      <div v-if="showAssistantMinimalToolbar" class="assistant-compact-toolbar">
        <n-button v-if="canImportLocalModel" size="small" strong secondary class="import-btn" @click="openLocalModel">
          导入模型
        </n-button>
        <n-dropdown
          v-if="isAssistantView"
          trigger="click"
          :show-arrow="false"
          placement="bottom-end"
          :options="assistantModelDropdownOptions"
          @select="handlePresetModelSelect">
          <div :class="['model-select-btn', { active: selectedModelKey && selectedModelKey !== 'local' }]">
            <span class="model-select-text">{{ selectedModelLabel }}</span>
            <svg class="size-12px model-select-icon"><use href="#down"></use></svg>
          </div>
        </n-dropdown>
      </div>
      <template v-else>
        <!-- 语言切换器 (仅在查看 README 时显示) -->
        <div v-if="!isViewingLink" class="flex-y-center w-full justify-between">
          <div class="flex-center gap-12px">
            <div :class="['lang-btn', { active: currentLang === 'zh' }]" @click="switchLanguage('zh')">中文</div>
            <div :class="['lang-btn', { active: currentLang === 'en' }]" @click="switchLanguage('en')">English</div>
          </div>
          <div class="flex-center">
            <n-button
              v-if="isAssistantView && canImportLocalModel"
              size="small"
              strong
              secondary
              class="import-btn"
              @click="openLocalModel">
              导入模型
            </n-button>
            <n-badge class="mr-14px" value="Beta" :color="'var(--bate-color)'">
              <div :class="['assistant-btn', { active: isAssistantView }]" @click="showAssistant()">3D预览</div>
            </n-badge>
            <n-dropdown
              v-if="isAssistantView"
              trigger="click"
              :show-arrow="false"
              placement="bottom-end"
              :options="assistantModelDropdownOptions"
              @select="handlePresetModelSelect">
              <div :class="['model-select-btn', { active: selectedModelKey && selectedModelKey !== 'local' }]">
                <span class="model-select-text">{{ selectedModelLabel }}</span>
                <svg class="size-12px model-select-icon"><use href="#down"></use></svg>
              </div>
            </n-dropdown>
          </div>
        </div>

        <!-- 当前页面标题和操作按钮 -->
        <div v-if="isViewingLink" class="page-title">{{ currentUrl }}</div>
        <div v-if="isViewingLink" class="open-in-browser-btn" @click="openInBrowser">
          <svg class="size-16px"><use href="#share"></use></svg>
          在浏览器中打开
        </div>
      </template>
    </div>

    <div class="bot-content">
      <n-loading-bar-provider ref="loadingBarRef" :to="false" :container-style="loadingBarContainerStyle">
        <!-- HuLa 小管家 3D 模型 -->
        <HuLaAssistant
          v-if="isAssistantView"
          :active="isAssistantView"
          :custom-model="customModelPath"
          @ready="handleAssistantReady"
          @error="handleAssistantError" />

        <!-- Markdown 内容区域 -->
        <div
          v-else-if="!isViewingLink"
          ref="markdownContainer"
          class="markdown-content markdown-body"
          v-html="renderedMarkdown"></div>

        <!-- 外部链接 Tauri Webview 容器 -->
        <div v-else ref="webviewContainer" class="external-webview">
          <div v-if="!canEmbedWebview" class="external-webview__fallback">
            当前环境不支持内嵌浏览器, 已尝试在系统浏览器打开
          </div>
        </div>
      </n-loading-bar-provider>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LoadingBarProviderInst } from 'naive-ui'
import { useBotView } from './useBotView'
const HuLaAssistant = defineAsyncComponent(() => import('./HuLaAssistant.vue'))

const loadingBarRef = ref<LoadingBarProviderInst | null>(null)

const startLoading = () => {
  loadingBarRef.value?.start()
}

const finishLoading = () => {
  loadingBarRef.value?.finish()
}

const errorLoading = () => {
  loadingBarRef.value?.error()
}

const loadingBarContainerStyle = {
  position: 'absolute',
  top: '0',
  left: '0',
  right: '0',
  pointerEvents: 'none'
} as const

const {
  currentLang,
  renderedMarkdown,
  isViewingLink,
  currentUrl,
  markdownContainer,
  webviewContainer,
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
  openInBrowser,
  goBack,
  switchLanguage,
  initialize,
  cleanup
} = useBotView({ startLoading, finishLoading, errorLoading })

onMounted(initialize)
onUnmounted(cleanup)
</script>

<style scoped lang="scss">
.bot-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  background: var(--bg-color);
}

.language-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-color);
  background: var(--bg-color);
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;

  .assistant-compact-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
    width: 100%;
  }

  .back-btn {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease;
    user-select: none;
    -webkit-user-select: none;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      @apply bg-[--color-primary]/40 text-[--color-primary];
    }
  }

  .page-title {
    flex: 1;
    font-size: 13px;
    color: var(--chat-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.25;
    padding: 0 12px;
    &:hover {
      text-decoration-line: underline;
      color: var(--color-primary);
    }
  }

  .open-in-browser-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      @apply bg-[--color-primary]/40 text-[--color-primary];
    }
  }

  .assistant-btn {
    padding: 6px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: linear-gradient(135deg, var(--color-primary) / 32, var(--color-primary-light));
    transition: all 0.2s ease-in-out;
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      color: var(--color-primary);
    }

    &.active {
      color: #ffffff;
      background: linear-gradient(135deg, #13987f, #1fb39b80);
      border-color: var(--color-primary) / 40;
    }
  }

  .model-select-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    margin-left: 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease-in-out;
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      color: var(--color-primary);
    }

    &.active {
      color: var(--color-primary);
      background: var(--color-primary) / 18;
      box-shadow: inset 0 0 0 1px var(--color-primary) / 25;
    }
  }

  .model-select-text {
    white-space: nowrap;
  }

  .model-select-icon {
    color: currentColor;
  }

  .lang-btn {
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease;
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      @apply dark:bg-[--color-primary]/40 bg-[#e8f4f1] text-[--color-primary];
    }

    &.active {
      @apply dark:bg-[--color-primary]/40 bg-[#e8f4f1] text-[--color-primary];
      box-shadow: inset 0 0 0 1px var(--color-primary) / 60;
    }
  }

  .import-btn {
    margin-right: 16px;
  }
}

.bot-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.external-webview {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  position: relative;
  box-sizing: border-box;
}

.external-webview__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-color-secondary, #909090);
  font-size: 14px;
  padding: 16px;
  text-align: center;
}

// Markdown 内容容器
.markdown-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  background-color: transparent;
  color: var(--text-color);
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1.7;
  word-wrap: break-word;
  overflow-wrap: break-word;

  // 强制所有直接子元素不超出容器
  > * {
    max-width: 100%;
  }
  --fgColor-default: var(--text-color);
  --fgColor-muted: var(--chat-text-color, var(--text-color));
  --fgColor-accent: var(--color-primary);
  --fgColor-attention: var(--color-primary);
  --fgColor-success: var(--success-color, #13987f);
  --fgColor-danger: var(--danger-color, #d1242f);
  --bgColor-default: var(--bg-color);
  --bgColor-muted: var(--bg-msg-hover);
  --bgColor-neutral-muted: rgba(144, 144, 144, 0.15);
  --bgColor-attention-muted: var(--color-primary)/16;
  --borderColor-default: var(--line-color);
  --borderColor-muted: var(--line-color);
  --borderColor-neutral-muted: rgba(144, 144, 144, 0.2);
  --borderColor-accent-emphasis: var(--color-primary);

  // 通用表格处理
  :deep(table) {
    display: table;
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    overflow-x: auto;
    box-sizing: border-box;
    margin: 16px 0;

    tbody,
    thead {
      display: table;
      width: 100%;
      table-layout: auto;
    }

    tr {
      display: table-row;
    }

    td,
    th {
      display: table-cell;
      padding: 8px 10px;
      border: 1px solid var(--borderColor-default);
      word-break: break-word;
      overflow-wrap: break-word;
    }

    th {
      background: var(--bgColor-neutral-muted);
      font-weight: 600;
      text-align: left;
    }
  }

  // 代码块自适应 - 在容器内滚动
  :deep(pre) {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: pre;
    word-wrap: normal;
    box-sizing: border-box;
    margin: 16px 0;

    code {
      display: inline-block;
      min-width: 100%;
      white-space: pre;
      word-wrap: normal;
    }
  }

  // 行内代码自适应
  :deep(code) {
    max-width: 100%;
    word-break: break-word;
    box-sizing: border-box;
  }

  // 图片自适应
  :deep(img) {
    max-width: 100%;
    height: auto;
    box-sizing: border-box;
  }

  // 长 URL 和文本处理
  :deep(a) {
    color: var(--color-primary);
    word-break: break-word;
    overflow-wrap: break-word;
    text-decoration: none;
  }

  :deep(a:hover) {
    text-decoration: underline;
  }

  // 段落和标题自适应
  :deep(p),
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-sizing: border-box;
    margin: 0 0 12px;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-weight: 700;
    line-height: 1.4;
  }

  :deep(h1) {
    font-size: 26px;
  }

  :deep(h2) {
    font-size: 22px;
  }

  :deep(h3) {
    font-size: 18px;
  }

  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 16px;
  }

  // 列表自适应
  :deep(ul),
  :deep(ol) {
    max-width: 100%;
    box-sizing: border-box;
    padding-left: 20px;
    margin: 0 0 12px;
  }

  :deep(li) {
    margin-bottom: 6px;
  }

  // 引用块自适应
  :deep(blockquote) {
    max-width: 100%;
    overflow-x: auto;
    box-sizing: border-box;
    padding: 8px 12px;
    margin: 12px 0;
    border-left: 3px solid var(--fgColor-accent);
    background: var(--bgColor-attention-muted);
  }

  // div 和其他容器自适应
  :deep(div) {
    max-width: 100%;
    box-sizing: border-box;
  }

  // 美化滚动条
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(144, 144, 144, 0.3);
    border-radius: 3px;

    &:hover {
      background: rgba(144, 144, 144, 0.5);
    }
  }
}
</style>
