<template>
  <article
    role="log"
    :aria-label="`Message from ${message.role === 'user' ? ctx.translate('ai_assistant.robot.me') : 'OpenClaw'}`"
    class="openclaw-workbench__message"
    :class="{
      'openclaw-workbench__message--user': message.role === 'user',
      'openclaw-workbench__message--assistant': message.role === 'assistant',
      'openclaw-workbench__message--error': message.status === 'error',
      'openclaw-workbench__message--streaming': message.status === 'streaming'
    }">
    <div class="openclaw-workbench__message-meta">
      <span class="openclaw-workbench__message-sender">
        {{ message.role === 'user' ? ctx.translate('ai_assistant.robot.me') : 'OpenClaw' }}
      </span>
      <span v-if="message.model" class="openclaw-workbench__message-model">{{ message.model }}</span>
      <span class="openclaw-workbench__message-time">{{ ctx.formatTime(message.createdAt) }}</span>
    </div>
    <div class="openclaw-workbench__message-bubble">
      <div class="openclaw-workbench__message-content">
        <template v-if="message.role === 'user'">
          <span v-if="searchQuery" v-html="highlightedContent" />
          <template v-else>{{ message.content }}</template>
        </template>
        <template v-else>
          <div
            v-if="message.reasoningContent"
            class="openclaw-workbench__reasoning-content"
            :class="{
              'openclaw-workbench__reasoning-content--expanded': ctx.expandedReasoningIds.includes(message.id)
            }">
            <div
              role="button"
              tabindex="0"
              :aria-expanded="ctx.expandedReasoningIds.includes(message.id)"
              :aria-controls="`reasoning-body-${message.id}`"
              class="openclaw-workbench__reasoning-header"
              @click="ctx.toggleReasoning(message.id)"
              @keydown.enter="ctx.toggleReasoning(message.id)">
              <div class="openclaw-workbench__reasoning-title">
                <Icon icon="mdi:brain" class="openclaw-workbench__reasoning-icon" />
                <span>{{ ctx.translate('ai_assistant.robot.thinking_process') }}</span>
              </div>
              <Icon
                icon="mdi:chevron-down"
                class="openclaw-workbench__reasoning-toggle"
                :class="{
                  'openclaw-workbench__reasoning-toggle--expanded': ctx.expandedReasoningIds.includes(message.id)
                }" />
            </div>
            <transition name="reasoning-fade">
              <div
                v-show="ctx.expandedReasoningIds.includes(message.id)"
                :id="`reasoning-body-${message.id}`"
                class="openclaw-workbench__reasoning-body">
                <div class="openclaw-workbench__markdown-container" :class="{ 'is-dark': ctx.isDarkTheme }">
                  <component
                    :is="ctx.markdownRender"
                    v-if="ctx.markdownRender"
                    :content="message.reasoningContent"
                    :custom-id="ctx.markdownCustomId"
                    :is-dark="ctx.isDarkTheme"
                    :enable-monaco="false"
                    :viewportPriority="false"
                    :themes="ctx.markdownThemes"
                    :code-block-props="ctx.markdownCodeBlockProps" />
                </div>
              </div>
            </transition>
          </div>

          <div
            ref="markdownContentRef"
            class="openclaw-workbench__markdown-container"
            :class="{ 'is-dark': ctx.isDarkTheme }">
            <component
              :is="ctx.markdownRender"
              v-if="ctx.markdownRender"
              :content="message.content"
              :custom-id="ctx.markdownCustomId"
              :is-dark="ctx.isDarkTheme"
              :enable-monaco="false"
              :viewportPriority="false"
              :themes="ctx.markdownThemes"
              :code-block-props="ctx.markdownCodeBlockProps" />
          </div>
        </template>
      </div>

      <div class="openclaw-workbench__message-actions">
        <button
          type="button"
          class="openclaw-workbench__message-action"
          :class="{ 'openclaw-workbench__message-action--success': ctx.copiedMessageId === message.id }"
          @click="ctx.handleCopyMessage(message.content, message.id)"
          :title="ctx.translate('common.copy')"
          :aria-label="ctx.translate('common.copy')">
          <svg v-if="ctx.copiedMessageId === message.id"><use href="#success"></use></svg>
          <svg v-else><use href="#copy"></use></svg>
        </button>
        <button
          v-if="message.role === 'assistant'"
          type="button"
          class="openclaw-workbench__message-action"
          @click="ctx.handleRegenerate(message.id)"
          :title="ctx.translate('ai_assistant.robot.openclaw_retry_last_prompt')"
          :aria-label="ctx.translate('ai_assistant.robot.openclaw_retry_last_prompt')">
          <svg><use href="#refresh"></use></svg>
        </button>
      </div>

      <div
        v-if="message.status === 'streaming'"
        aria-live="polite"
        class="openclaw-workbench__message-streaming-dot"></div>
    </div>
    <p v-if="message.status === 'error' && message.errorMessage" class="openclaw-workbench__message-error">
      {{ message.errorMessage }}
    </p>
  </article>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify'
import { computed, nextTick, ref, watch } from 'vue'
import { useOpenClawContext } from '../composables/useOpenClawContext'
import type { OpenClawWorkbenchMessage } from '../types'

const props = defineProps<{
  message: OpenClawWorkbenchMessage
  searchQuery?: string
  isCurrentMatch?: boolean
}>()

const ctx = useOpenClawContext()

const markdownContentRef = ref<HTMLElement | null>(null)

const highlightedContent = computed(() => {
  const query = props.searchQuery?.trim()
  if (!query || props.message.role !== 'user') return ''
  const content = DOMPurify.sanitize(props.message.content)
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  return content.replace(regex, '<mark class="openclaw-workbench__highlight">$1</mark>')
})

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Highlight text in assistant markdown content via DOM manipulation
const applyMarkdownHighlight = () => {
  const el = markdownContentRef.value
  if (!el) return

  // Remove existing highlights
  const existingMarks = el.querySelectorAll('mark.openclaw-workbench__highlight')
  for (const mark of existingMarks) {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
      parent.normalize()
    }
  }

  const query = props.searchQuery?.trim()
  if (!query || props.message.role !== 'assistant') return

  highlightTextInElement(el, query)
}

function highlightTextInElement(el: HTMLElement, query: string) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.textContent?.toLowerCase().includes(query.toLowerCase())) {
      textNodes.push(node)
    }
  }

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  for (const textNode of textNodes) {
    const parts = textNode.textContent!.split(regex)
    if (parts.length <= 1) continue

    const fragment = document.createDocumentFragment()
    for (const part of parts) {
      if (regex.test(part)) {
        const mark = document.createElement('mark')
        mark.className = 'openclaw-workbench__highlight'
        mark.textContent = part
        fragment.appendChild(mark)
      } else {
        fragment.appendChild(document.createTextNode(part))
      }
    }
    textNode.parentNode?.replaceChild(fragment, textNode)
  }
}

watch(
  () => [props.searchQuery, props.message.content, props.isCurrentMatch],
  () => {
    if (props.message.role === 'assistant') {
      nextTick(() => applyMarkdownHighlight())
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.openclaw-workbench__message {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(760px, 92%);
  animation: message-fade-in 0.3s ease-out;
}

@keyframes message-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.openclaw-workbench__message--user {
  align-self: flex-end;
}

.openclaw-workbench__message--assistant {
  align-self: flex-start;
}

.openclaw-workbench__message-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__message--user .openclaw-workbench__message-meta {
  flex-direction: row-reverse;
}

.openclaw-workbench__message-sender {
  font-weight: 700;
  color: var(--color-text-secondary);
}

.openclaw-workbench__message-model {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-msg-hover);
  font-size: 11px;
}

.openclaw-workbench__message-bubble {
  position: relative;
  padding: 14px 16px;
  border-radius: 20px;
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
  color: var(--text-color);
  background: var(--bg-bubble);
  border: 1px solid var(--line-color);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.openclaw-workbench__message--user .openclaw-workbench__message-bubble {
  background: var(--chat-left-bg);
  color: var(--text-color);
  border-color: transparent;
  border-bottom-right-radius: 4px;
}

.openclaw-workbench__message--assistant .openclaw-workbench__message-bubble {
  border-bottom-left-radius: 4px;
}

.openclaw-workbench__message--error .openclaw-workbench__message-bubble {
  border-color: var(--danger-bg);
  background: color-mix(in srgb, var(--danger-text) 4%, var(--bg-bubble));
}

.openclaw-workbench__message-content {
  overflow: hidden;
  white-space: pre-wrap;
  transition: all 0.2s ease;
}

.openclaw-workbench__message-content:has(.openclaw-workbench__markdown-container) {
  white-space: normal;
}

.openclaw-workbench__message--streaming
  .openclaw-workbench__message-content
  :deep(.markdown-body > *:last-child::after) {
  content: '';
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--color-primary);
  margin-left: 4px;
  vertical-align: middle;
  animation: cursor-blink 1s infinite;
}

@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.openclaw-workbench__reasoning-content {
  margin-bottom: 12px;
  border-radius: 12px;
  background: var(--bg-msg-hover);
  border: 1px dashed var(--line-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.openclaw-workbench__reasoning-content--expanded {
  background: var(--bg-msg-hover);
  border-style: solid;
  border-color: var(--color-primary-light);
}

.openclaw-workbench__reasoning-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.openclaw-workbench__reasoning-header:hover {
  background: color-mix(in srgb, var(--color-primary) 4%, transparent);
}

.openclaw-workbench__reasoning-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__reasoning-icon {
  font-size: 16px;
  color: var(--color-primary);
  animation: brain-pulse 2s infinite ease-in-out;
}

@keyframes brain-pulse {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
}

.openclaw-workbench__reasoning-toggle {
  font-size: 16px;
  color: var(--color-text-tertiary);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.openclaw-workbench__reasoning-toggle--expanded {
  transform: rotate(180deg);
}

.openclaw-workbench__reasoning-body {
  padding: 0 14px 14px;
}

.reasoning-fade-enter-active,
.reasoning-fade-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
}

.reasoning-fade-enter-from,
.reasoning-fade-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.openclaw-workbench__markdown-container {
  width: 100%;
}

:deep(.openclaw-workbench__markdown-container .markstream-vue-container) {
  padding: 0;
  background: transparent !important;
}

:deep(.openclaw-workbench__markdown-container .markdown-body) {
  font-size: 14px;
  line-height: 1.6;
  background: transparent !important;
  color: inherit !important;
  font-family: inherit;
}

:deep(.openclaw-workbench__markdown-container .code-block-wrapper) {
  margin: 12px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line-color);
}

.openclaw-workbench__message-actions {
  position: absolute;
  right: 0;
  bottom: -32px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  background: var(--center-bg-color);
  padding: 4px 8px;
  border-radius: 10px;
  border: 1px solid var(--line-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 5;
}

.openclaw-workbench__message:hover .openclaw-workbench__message-actions {
  opacity: 1;
  visibility: visible;
  bottom: -28px;
}

.openclaw-workbench__message-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--color-text-tertiary);
  transition: all 0.2s ease;
}

.openclaw-workbench__message-action:hover {
  color: var(--color-primary);
  background: var(--bg-msg-hover);
}

.openclaw-workbench__message-action--success {
  color: var(--color-success) !important;
}

.openclaw-workbench__message-action svg {
  width: 14px;
  height: 14px;
}

.openclaw-workbench__message-streaming-dot {
  position: absolute;
  left: 12px;
  bottom: -20px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 10px var(--color-primary-hover);
  animation: streaming-pulse 1.2s infinite;
}

@keyframes streaming-pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
}

.openclaw-workbench__message-error {
  margin: 4px 12px 0;
  font-size: 12px;
  color: var(--danger-text);
  font-weight: 500;
}
</style>

<style>
.openclaw-workbench__highlight {
  background: var(--color-primary-light);
  border-radius: 2px;
  color: inherit;
  padding: 0 1px;
}
</style>
