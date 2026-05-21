<template>
  <aside class="openclaw-workbench__sidebar" :class="{ 'openclaw-workbench__sidebar--mobile': isMobile }">
    <div class="openclaw-workbench__brand">
      <div class="openclaw-workbench__brand-icon">
        <svg><use href="#robot"></use></svg>
      </div>
      <div>
        <h1 class="openclaw-workbench__brand-title">OpenClaw</h1>
        <p class="openclaw-workbench__brand-subtitle">
          {{ ctx.translate('ai_assistant.robot.openclaw_workspace_subtitle') }}
        </p>
      </div>
    </div>

    <div class="openclaw-workbench__sidebar-actions">
      <n-button type="primary" block class="openclaw-workbench__new-chat-btn" @click="ctx.handleCreateConversation">
        <template #icon>
          <svg class="openclaw-workbench__button-icon"><use href="#plus"></use></svg>
        </template>
        <strong>{{ ctx.translate('ai_assistant.robot.openclaw_new_chat') }}</strong>
      </n-button>
    </div>

    <div class="openclaw-workbench__sidebar-meta">
      <div
        class="openclaw-workbench__status-pill"
        :data-state="ctx.connectionState.state"
        role="button"
        tabindex="0"
        aria-label="连接状态"
        @click="ctx.focusConfigSection"
        @keydown.enter="ctx.focusConfigSection">
        <span class="openclaw-workbench__status-dot"></span>
        <span>{{ ctx.connectionStateText }}</span>
      </div>
    </div>

    <div class="openclaw-workbench__sidebar-section">
      <div class="openclaw-workbench__sidebar-header">
        <h3 class="openclaw-workbench__sidebar-label">{{ ctx.translate('ai_assistant.robot.generation_history') }}</h3>
        <n-button
          v-if="ctx.conversations.length > 0"
          size="tiny"
          quaternary
          type="error"
          @click="ctx.handleDeleteAllConversations">
          {{ ctx.translate('ai_assistant.robot.delete_all') }}
        </n-button>
      </div>
      <n-scrollbar class="openclaw-workbench__conversation-scroll">
        <div class="openclaw-workbench__conversation-list" role="list">
          <button
            v-for="conversation in ctx.conversations"
            :key="conversation.id"
            type="button"
            role="listitem"
            class="openclaw-workbench__conversation"
            :class="{ 'openclaw-workbench__conversation--active': conversation.id === ctx.activeConversationId }"
            :aria-current="conversation.id === ctx.activeConversationId ? 'true' : undefined"
            @click="ctx.handleSelectConversation(conversation.id)">
            <div class="openclaw-workbench__conversation-head">
              <template v-if="ctx.editingConversationId === conversation.id">
                <n-input
                  :value="ctx.editingTitle"
                  size="small"
                  class="openclaw-workbench__conversation-input"
                  autofocus
                  @update:value="onUpdateEditingTitle"
                  @keyup.enter="ctx.submitRename"
                  @blur="ctx.submitRename"
                  @click.stop />
              </template>
              <template v-else>
                <span class="openclaw-workbench__conversation-title">{{ conversation.title }}</span>
                <div class="openclaw-workbench__conversation-actions">
                  <button
                    type="button"
                    class="openclaw-workbench__conversation-action"
                    aria-label="重命名"
                    @click.stop="ctx.handleRenameConversation(conversation.id, conversation.title)">
                    <svg><use href="#edit"></use></svg>
                  </button>
                  <button
                    v-if="ctx.conversations.length > 1"
                    type="button"
                    class="openclaw-workbench__conversation-action openclaw-workbench__conversation-action--delete"
                    aria-label="删除"
                    @click.stop="ctx.handleDeleteConversation(conversation.id)">
                    <svg><use href="#delete"></use></svg>
                  </button>
                </div>
              </template>
            </div>
            <p class="openclaw-workbench__conversation-preview">
              {{ ctx.getPreview(conversation) }}
            </p>
            <span class="openclaw-workbench__conversation-time">{{ ctx.formatTime(conversation.updatedAt) }}</span>
          </button>
        </div>
      </n-scrollbar>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useOpenClawContext } from '../composables/useOpenClawContext'

defineProps<{
  isMobile?: boolean
}>()

const ctx = useOpenClawContext()

const onUpdateEditingTitle = (val: string) => {
  ctx.editingTitle = val
}
</script>

<style scoped>
.openclaw-workbench__sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 16px 12px;
  border-right: 1px solid var(--line-color);
  background: var(--center-bg-color);
}

.openclaw-workbench__sidebar--mobile {
  width: 100%;
  height: 100%;
  border-right: none;
  background: var(--center-bg-color);
}

.openclaw-workbench__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.openclaw-workbench__brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-info));
  color: var(--hula-text-inverse);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.openclaw-workbench__brand-icon svg {
  width: 22px;
  height: 22px;
}

.openclaw-workbench__brand-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color);
}

.openclaw-workbench__brand-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__sidebar-actions,
.openclaw-workbench__sidebar-meta,
.openclaw-workbench__sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.openclaw-workbench__sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.openclaw-workbench__sidebar-label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-left-menu);
  color: var(--color-text-secondary);
}

.openclaw-workbench__status-pill:hover {
  background: var(--bg-left-menu-hover);
}

.openclaw-workbench__status-pill[data-state='connected'] {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
}

.openclaw-workbench__status-pill[data-state='connecting'],
.openclaw-workbench__status-pill[data-state='reconnecting'] {
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
}

.openclaw-workbench__status-pill[data-state='error'] {
  color: var(--danger-text);
  background: var(--danger-bg);
}

.openclaw-workbench__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.openclaw-workbench__conversation-scroll {
  flex: 1;
  min-height: 0;
}

.openclaw-workbench__conversation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.openclaw-workbench__conversation {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.openclaw-workbench__conversation:hover {
  background: var(--bg-msg-hover);
}

.openclaw-workbench__conversation--active {
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
  background: var(--bg-msg-hover);
}

.openclaw-workbench__conversation-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.openclaw-workbench__conversation-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.openclaw-workbench__conversation-input {
  flex: 1;
}

.openclaw-workbench__conversation-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.openclaw-workbench__conversation:hover .openclaw-workbench__conversation-actions {
  opacity: 1;
}

.openclaw-workbench__conversation-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--color-text-tertiary);
  transition: all 0.2s ease;
}

.openclaw-workbench__conversation-action:hover {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.openclaw-workbench__conversation-action--delete:hover {
  color: var(--danger-text);
  background: var(--danger-bg);
}

.openclaw-workbench__conversation-action svg {
  width: 14px;
  height: 14px;
}

.openclaw-workbench__conversation-preview {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text-tertiary);
  display: -webkit-box;
  display: box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  box-orient: vertical;
  overflow: hidden;
}

.openclaw-workbench__conversation-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
</style>
