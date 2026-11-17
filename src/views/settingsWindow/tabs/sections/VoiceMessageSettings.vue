<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.voice_video.voice_messages.title') }}</h3>
    <p class="section-desc">{{ t('setting.voice_video.voice_messages.desc') }}</p>

    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-value">{{ stats.totalMessages }}</span>
        <span class="stat-label">{{ t('setting.voice_video.voice_messages.total_messages') }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ formatDuration(stats.totalDuration) }}</span>
        <span class="stat-label">{{ t('setting.voice_video.voice_messages.total_duration') }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ formatDuration(stats.averageDuration) }}</span>
        <span class="stat-label">{{ t('setting.voice_video.voice_messages.average_duration') }}</span>
      </div>
    </div>

    <div class="stats-row" data-testid="voice-user-stats">
      <div class="stat-item">
        <span class="stat-value">{{ userStats.totalMessages }}</span>
        <span class="stat-label">{{ t('setting.voice_video.voice_messages.my_total_messages') }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ formatDuration(userStats.totalDuration) }}</span>
        <span class="stat-label">{{ t('setting.voice_video.voice_messages.my_total_duration') }}</span>
      </div>
    </div>

    <div class="config-section" data-testid="voice-config">
      <h4 class="config-title">{{ t('setting.voice_video.voice_messages.config_title') }}</h4>
      <div v-if="config" class="config-grid">
        <div class="config-item">
          <span class="config-label">{{ t('setting.voice_video.voice_messages.config_max_duration') }}</span>
          <span class="config-value">{{ formatDuration(config.maxDuration) }}</span>
        </div>
        <div class="config-item">
          <span class="config-label">{{ t('setting.voice_video.voice_messages.config_formats') }}</span>
          <span class="config-value">{{ config.allowedFormats.join(', ') || '-' }}</span>
        </div>
        <div class="config-item">
          <span class="config-label">{{ t('setting.voice_video.voice_messages.config_auto_transcribe') }}</span>
          <span class="config-value">
            {{
              config.autoTranscribe
                ? t('setting.voice_video.voice_messages.config_enabled')
                : t('setting.voice_video.voice_messages.config_disabled')
            }}
          </span>
        </div>
      </div>
      <p v-else class="config-hint">{{ t('setting.voice_video.voice_messages.config_unavailable') }}</p>
    </div>

    <div class="list-toolbar">
      <n-input
        v-model:value="roomFilter"
        clearable
        :placeholder="t('setting.voice_video.voice_messages.room_placeholder')"
        class="room-input"
        @keyup.enter="loadMessages" />
      <n-button size="small" :loading="loading" data-testid="voice-messages-refresh" @click="loadMessages">
        {{ t('common.refresh') }}
      </n-button>
    </div>

    <n-spin :show="loading">
      <div v-if="messages.length > 0" class="voice-list">
        <div v-for="message in messages" :key="message.media_id" class="voice-item">
          <div class="voice-main">
            <span class="voice-id">{{ message.media_id }}</span>
            <span class="voice-meta">
              {{ formatDuration(Math.round(message.duration_ms / 1000)) }} · {{ formatBytes(message.size_bytes) }} ·
              {{ formatTs(message.created_ts) }}
            </span>
            <pre v-if="expandedId === message.media_id" class="voice-json">{{ expandedContent }}</pre>
          </div>
          <div class="voice-actions">
            <n-button size="tiny" :loading="contentLoadingId === message.media_id" @click="handleShowContent(message)">
              {{ t('setting.voice_video.voice_messages.view_content') }}
            </n-button>
            <n-popconfirm @positive-click="handleDelete(message.media_id)">
              <template #trigger>
                <n-button size="tiny" type="error" data-testid="voice-message-delete">
                  {{ t('setting.voice_video.voice_messages.delete') }}
                </n-button>
              </template>
              {{ t('setting.voice_video.voice_messages.delete_confirm') }}
            </n-popconfirm>
          </div>
        </div>
      </div>
      <n-empty v-else :description="t('setting.voice_video.voice_messages.empty')" />
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NInput, NPopconfirm, NSpin } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixVoiceService } from '@/services/matrix/media/MatrixVoiceService'
import { formatBytes, formatDuration } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'VoiceMessageSettings'
})

type VoiceMessageRow = Awaited<ReturnType<typeof matrixVoiceService.getUserVoiceList>>['messages'][number]

const logger = createLogger('VoiceMessageSettings')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const messages = ref<VoiceMessageRow[]>([])
const roomFilter = ref('')
const stats = ref({ totalDuration: 0, totalMessages: 0, averageDuration: 0 })
const userStats = ref({ totalDuration: 0, totalMessages: 0 })
const config = ref<{ maxDuration: number; allowedFormats: string[]; autoTranscribe: boolean } | null>(null)
const expandedId = ref('')
const expandedContent = ref('')
const contentLoadingId = ref('')

onMounted(() => {
  loadMessages()
  loadConfig()
})

async function loadConfig() {
  try {
    config.value = await matrixVoiceService.getVoiceConfig()
  } catch (error) {
    logger.warn('Voice config unavailable', error)
    config.value = null
  }
}

async function loadMessages() {
  const userId = matrixClientService.getUserId()
  if (!userId) return
  loading.value = true
  try {
    const [page, voiceStats, ownStats] = await Promise.all([
      roomFilter.value.trim()
        ? matrixVoiceService.getRoomVoiceList(roomFilter.value.trim())
        : matrixVoiceService.getUserVoiceList(userId),
      matrixVoiceService.getVoiceStats(),
      matrixVoiceService.getUserVoiceStats(userId)
    ])
    messages.value = page.messages
    stats.value = voiceStats
    userStats.value = ownStats
  } catch (error) {
    logger.error('Failed to load voice messages', error)
    showFeedback(t('setting.voice_video.voice_messages.load_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleShowContent(message: VoiceMessageRow) {
  if (expandedId.value === message.media_id) {
    expandedId.value = ''
    expandedContent.value = ''
    return
  }
  contentLoadingId.value = message.media_id
  try {
    const content = await matrixVoiceService.getVoiceContent(message.media_id)
    expandedId.value = message.media_id
    expandedContent.value = content
      ? JSON.stringify(content, null, 2)
      : t('setting.voice_video.voice_messages.content_empty')
  } catch (error) {
    logger.error('Failed to load voice content', error)
    showFeedback(t('setting.voice_video.voice_messages.load_failed'), 'error')
  } finally {
    contentLoadingId.value = ''
  }
}

async function handleDelete(mediaId: string) {
  try {
    await matrixVoiceService.deleteVoice(mediaId)
    showFeedback(t('setting.voice_video.voice_messages.delete_success'), 'success')
    await loadMessages()
  } catch (error) {
    logger.error('Failed to delete voice message', error)
    showFeedback(t('setting.voice_video.voice_messages.delete_failed'), 'error')
  }
}

function formatTs(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}
</script>

<style scoped>
.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin: 0 0 var(--tjg-space-4) 0;
  color: var(--tjg-text-primary);
}

.section-desc {
  margin: calc(var(--tjg-space-2) * -1) 0 var(--tjg-space-4);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.stats-row {
  display: flex;
  gap: var(--tjg-space-6);
  padding: var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
  margin-bottom: var(--tjg-space-3);
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: var(--tjg-font-size-lg);
  color: var(--tjg-text-primary);
}

.stat-label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.config-section {
  padding: var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
  margin-bottom: var(--tjg-space-3);
}

.config-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin: 0 0 var(--tjg-space-2) 0;
}

.config-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tjg-space-4);
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.config-label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.config-value {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.config-hint {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.list-toolbar {
  display: flex;
  gap: var(--tjg-space-2);
  margin-bottom: var(--tjg-space-3);
}

.room-input {
  max-width: 320px;
}

.voice-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.voice-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3) var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.voice-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.voice-id {
  font-family: monospace;
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.voice-meta {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.voice-json {
  margin: var(--tjg-space-2) 0 0;
  padding: var(--tjg-space-2);
  max-height: 200px;
  overflow: auto;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  background-color: var(--tjg-settings-meter-bg);
  border-radius: var(--tjg-radius-xs);
}

.voice-actions {
  display: flex;
  gap: var(--tjg-space-2);
  flex-shrink: 0;
}
</style>
