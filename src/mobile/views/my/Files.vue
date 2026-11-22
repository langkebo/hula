<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_files.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <van-search v-model="searchQuery" :placeholder="t('mobile_files.search_placeholder')" shape="round" />

          <div class="flex items-center justify-between gap-8px">
            <!--
              配额四态与桌面统一：unsupported 不渲染，unavailable 提示暂不可用 + 重试，
              loading 占位不显示 0，ready 且有限额时展示用量。
            -->
            <div class="text-12px text-[--tjg-text-tertiary] min-w-0">
              <span v-if="quotaState === 'unavailable'" class="flex items-center gap-6px">
                <span>{{ t('mobile_files.quota_unavailable') }}</span>
                <button type="button" class="quota-retry" data-test="mobile-files-quota-retry" @click="loadQuota">
                  {{ t('common.retry') }}
                </button>
              </span>
              <span v-else-if="quotaState === 'loading'" data-test="mobile-files-quota-loading">
                {{ t('common.loading') }}
              </span>
              <span v-else-if="quota && quota.limitBytes > 0">
                {{
                  t('mobile_files.quota_used', {
                    used: formatBytes(quota.storageBytes),
                    total: formatBytes(quota.limitBytes),
                    count: quota.mediaCount
                  })
                }}
              </span>
            </div>
            <van-button size="small" type="primary" :loading="uploading" @click="triggerUpload">
              {{ t('mobile_files.upload') }}
            </van-button>
          </div>
          <input ref="uploadInputRef" type="file" class="hidden" @change="handleUploadChange" />

          <van-tabs v-model:active="activeTab" sticky>
            <van-tab :title="t('mobile_files.all')">
              <MobileAsyncState
                v-if="isFileListEmpty"
                state="empty"
                :empty-text="t('mobile_files.empty')"
                min-height="240px" />
              <div v-else class="flex flex-col gap-12px pt-12px">
                <div
                  v-for="file in filteredFiles"
                  :key="file.id"
                  class="bg-[--tjg-surface-panel] rounded-12px p-12px border border-[--tjg-border-default] flex items-center gap-12px"
                  @click="handleFileClick(file)">
                  <div
                    class="w-40px h-40px rounded-8px flex items-center justify-center"
                    :style="{ backgroundColor: getFileTypeColor(file.type) }">
                    <svg class="w-24px h-24px color-[--tjg-text-inverse]" aria-hidden="true">
                      <use :href="`#${getFileIcon(file.type)}`" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-14px font-medium truncate text-[--tjg-text-primary]">{{ file.name }}</div>
                    <div class="text-12px text-[--tjg-text-quaternary]">
                      {{ formatBytes(file.size) }} · {{ formatTime(file.time) }}
                    </div>
                  </div>
                  <van-icon name="ellipsis" @click.stop="showFileOptions(file)" />
                </div>
              </div>
            </van-tab>

            <van-tab :title="t('mobile_files.documents')">
              <div class="flex flex-col gap-12px pt-12px">
                <div
                  v-for="file in documentFiles"
                  :key="file.id"
                  class="bg-[--tjg-surface-panel] rounded-12px p-12px border border-[--tjg-border-default] flex items-center gap-12px">
                  <div
                    class="w-40px h-40px rounded-8px flex items-center justify-center"
                    :style="documentIconShellStyle">
                    <svg class="w-24px h-24px color-[--tjg-color-info-500]" aria-hidden="true">
                      <use href="#notes" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-14px font-medium truncate text-[--tjg-text-primary]">{{ file.name }}</div>
                    <div class="text-12px text-[--tjg-text-quaternary]">{{ formatBytes(file.size) }}</div>
                  </div>
                </div>
              </div>
            </van-tab>

            <van-tab :title="t('mobile_files.media')">
              <div class="grid grid-cols-3 gap-8px pt-12px">
                <div v-for="file in mediaFiles" :key="file.id" class="aspect-square rounded-8px overflow-hidden">
                  <img
                    v-if="file.type === 'image'"
                    :src="file.url"
                    class="w-full h-full object-cover"
                    :alt="t('mobile_files.image_alt')" />
                  <div v-else class="w-full h-full bg-[--tjg-surface-subtle] flex items-center justify-center">
                    <svg class="w-32px h-32px color-[--tjg-text-secondary]" aria-hidden="true">
                      <use href="#play" />
                    </svg>
                  </div>
                </div>
              </div>
            </van-tab>
          </van-tabs>
        </div>
      </div>
    </template>

    <van-action-sheet
      v-model:show="showOptions"
      :actions="fileActions"
      :cancel-text="t('common.cancel')"
      @select="onActionSelect" />
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { openPath } from '@tauri-apps/plugin-opener'
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaQuotaStats } from '@/composables/useMediaQuotaStats'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileFiles')

const { t } = useI18n()

type MobileFile = {
  id: string
  name: string
  type: string
  size: number
  time: number
  url: string
  mxcUrl: string
}

type FileAction = {
  name: string
  color?: string
}

const searchQuery = ref('')
const activeTab = ref(0)
const showOptions = ref(false)
const selectedFile = ref<MobileFile | null>(null)
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const fileDownloadStore = useFileDownloadStore()
/** 本地已删除的文件（消息本身不受影响，仅从本页移除） */
const removedIds = ref<Set<string>>(new Set())

const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
/** 配额四态与桌面共用同一判据：unsupported 不渲染，unavailable 提示 + 重试（Y-14） */
const { state: quotaState, stats: quota, load: loadQuota } = useMediaQuotaStats()

onMounted(() => {
  void loadQuota()
})

const documentIconShellStyle = {
  backgroundColor: 'var(--tjg-color-info-100)'
} as const

/**
 * 从本地已同步的聊天消息中汇总媒体与文件。
 *
 * 之前这里是写死的演示数据（含 picsum 占位图），用户看到的并非自己的文件。
 * 服务层暂无「全局文件」查询接口，因此以本地缓存消息为数据源。
 */
const files = computed<MobileFile[]>(() => {
  const result: MobileFile[] = []
  const seen = new Set<string>()
  for (const messages of Object.values(chatStore.chatMessageListByRoomId)) {
    for (const item of messages ?? []) {
      const msg = item.message
      if (!msg?.id || seen.has(msg.id)) continue
      if (msg.status === MessageStatusEnum.FAILED || removedIds.value.has(msg.id)) continue

      const type = toFileType(msg.type)
      if (!type) continue
      seen.add(msg.id)
      const mxcUrl = msg.body.url ?? ''
      result.push({
        id: msg.id,
        name: msg.body.fileName || msg.body.body || msg.body.content || msg.id,
        type,
        size: msg.body.size ?? 0,
        time: msg.sendTime,
        url: resolveMediaUrl(mxcUrl),
        mxcUrl
      })
    }
  }
  return result.sort((a, b) => b.time - a.time)
})

function toFileType(msgType: MsgEnum): string | null {
  switch (msgType) {
    case MsgEnum.IMAGE:
      return 'image'
    case MsgEnum.VIDEO:
      return 'video'
    case MsgEnum.VOICE:
      return 'audio'
    case MsgEnum.FILE:
      return 'document'
    default:
      return null
  }
}

function resolveMediaUrl(mxcUrl?: string): string {
  if (!mxcUrl) return ''
  try {
    return matrixMediaService.getMediaUrl(mxcUrl, 240, 240) ?? ''
  } catch {
    return ''
  }
}

const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value
  return files.value.filter((f) => f.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const documentFiles = computed(() => files.value.filter((f) => f.type === 'document'))
const mediaFiles = computed(() => files.value.filter((f) => f.type === 'image' || f.type === 'video'))

/** 当前筛选结果为空：交给 MobileAsyncState 统一渲染 */
const isFileListEmpty = computed(() => filteredFiles.value.length === 0)

const fileActions = [
  { name: t('mobile_files.actions.open') },
  { name: t('mobile_files.actions.save') },
  { name: t('mobile_files.actions.forward') },
  { name: t('mobile_files.actions.delete'), color: 'var(--tjg-color-danger-500)' }
]

function getFileIcon(type: string): string {
  // 返回本地 iconpark sprite 的 symbol id，避免运行时联网拉取 iconify 图标
  const icons: Record<string, string> = {
    document: 'notes',
    image: 'photo',
    video: 'video-one',
    audio: 'Music'
  }
  return icons[type] || 'file'
}

function getFileTypeColor(type: string): string {
  const colors: Record<string, string> = {
    document: 'var(--tjg-color-info-500)',
    image: 'var(--tjg-color-success-500)',
    video: 'var(--tjg-color-beta-500)',
    audio: 'var(--tjg-color-warning-500)'
  }
  return colors[type] || 'var(--tjg-text-tertiary)'
}

// 统一使用 @/utils/Formatting 的 formatBytes

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

/** 打开文件：先经媒体服务解析原始地址并下载到本地，再交给系统打开（Y-13） */
async function handleFileClick(file: MobileFile) {
  if (!file.mxcUrl) {
    showToast({ type: 'fail', message: t('mobile_files.open_failed') })
    return
  }

  try {
    const httpUrl = matrixMediaService.getMediaUrl(file.mxcUrl)
    if (!httpUrl) {
      showToast({ type: 'fail', message: t('mobile_files.open_failed') })
      return
    }
    const localPath = await fileDownloadStore.downloadFile(httpUrl, file.name || file.id)
    if (!localPath) {
      showToast({ type: 'fail', message: t('mobile_files.open_failed') })
      return
    }
    await openPath(localPath)
  } catch (error) {
    logger.error('Failed to open file', error)
    showToast({ type: 'fail', message: t('mobile_files.open_failed') })
  }
}

function triggerUpload() {
  uploadInputRef.value?.click()
}

/** 上传入口复用媒体服务与消息服务：上传后发送到当前会话，文件才会进入本列表（Y-14） */
async function handleUploadChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const roomId = globalStore.currentSessionRoomId
  if (!roomId) {
    showToast({ type: 'fail', message: t('mobile_files.upload_no_room') })
    return
  }

  uploading.value = true
  try {
    const uploaded = await matrixMediaService.uploadFile(file)
    await matrixMessageService.sendStructuredMessage({
      id: `upload-${Date.now()}`,
      roomId,
      msgType: MsgEnum.FILE,
      body: {
        url: uploaded.contentUri,
        fileName: file.name,
        size: file.size,
        mimetype: uploaded.mimetype
      }
    })
    showToast({ type: 'success', message: t('mobile_files.upload_success') })
    void loadQuota()
  } catch (error) {
    logger.error('Failed to upload file', error)
    showToast({ type: 'fail', message: t('mobile_files.upload_failed') })
  } finally {
    uploading.value = false
  }
}

function showFileOptions(file: MobileFile) {
  selectedFile.value = file
  showOptions.value = true
}

async function onActionSelect(action: FileAction) {
  const file = selectedFile.value
  if (!file) return

  if (action.name === t('mobile_files.actions.open')) {
    await handleFileClick(file)
    return
  }

  if (action.name === t('mobile_files.actions.delete')) {
    // Matrix 没有面向普通用户的媒体删除接口（仅管理员可用），因此这里只从本页移除，并如实告知
    try {
      await showConfirmDialog({
        message: t('mobile_files.delete_confirm'),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel')
      })
    } catch {
      return
    }
    removedIds.value = new Set([...removedIds.value, file.id])
    showToast(t('mobile_files.removed'))
    return
  }

  showToast(`${action.name}: ${file.name}`)
}
</script>

<style scoped>
.quota-retry {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-size: inherit;
  color: var(--tjg-color-primary-500);
}
</style>
