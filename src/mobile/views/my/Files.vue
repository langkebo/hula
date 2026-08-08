<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_files.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <van-search v-model="searchQuery" :placeholder="t('mobile_files.search_placeholder')" shape="round" />

          <van-tabs v-model:active="activeTab" sticky>
            <van-tab :title="t('mobile_files.all')">
              <div v-if="filteredFiles.length === 0" class="flex flex-col items-center justify-center py-60px">
                <Icon icon="mdi:folder-outline" :width="48" color="var(--tjg-border-default)" />
                <div class="text-14px text-[--tjg-text-quaternary] mt-12px">{{ t('mobile_files.empty') }}</div>
              </div>
              <div v-else class="flex flex-col gap-12px pt-12px">
                <div
                  v-for="file in filteredFiles"
                  :key="file.id"
                  class="bg-[--tjg-surface-panel] rounded-12px p-12px border border-[--tjg-border-default] flex items-center gap-12px"
                  @click="handleFileClick(file)">
                  <div
                    class="w-40px h-40px rounded-8px flex items-center justify-center"
                    :style="{ backgroundColor: getFileTypeColor(file.type) }">
                    <Icon :icon="getFileIcon(file.type)" :width="24" color="var(--tjg-text-inverse)" />
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
                    <Icon icon="mdi:file-document" :width="24" color="var(--tjg-color-info-500)" />
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
                  <img v-if="file.type === 'image'" :src="file.url" class="w-full h-full object-cover" alt="文件图片" />
                  <div v-else class="w-full h-full bg-[--tjg-surface-subtle] flex items-center justify-center">
                    <Icon icon="mdi:play-circle" :width="32" color="var(--tjg-text-secondary)" />
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
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatBytes } from '@/utils/Formatting'

const { t } = useI18n()

type MobileFile = {
  id: string
  name: string
  type: string
  size: number
  time: number
  url: string
}

type FileAction = {
  name: string
  color?: string
}

const searchQuery = ref('')
const activeTab = ref(0)
const showOptions = ref(false)
const selectedFile = ref<MobileFile | null>(null)

const documentIconShellStyle = {
  backgroundColor: 'var(--tjg-color-info-100)'
} as const

const files = ref<MobileFile[]>([
  { id: '1', name: '项目文档.pdf', type: 'document', size: 2048000, time: Date.now() - 3600000, url: '' },
  { id: '2', name: '会议记录.docx', type: 'document', size: 1024000, time: Date.now() - 7200000, url: '' },
  {
    id: '3',
    name: '产品截图.png',
    type: 'image',
    size: 512000,
    time: Date.now() - 86400000,
    url: 'https://picsum.photos/200/200?random=3'
  },
  { id: '4', name: '演示视频.mp4', type: 'video', size: 10240000, time: Date.now() - 172800000, url: '' }
])

const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value
  return files.value.filter((f) => f.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const documentFiles = computed(() => files.value.filter((f) => f.type === 'document'))
const mediaFiles = computed(() => files.value.filter((f) => f.type === 'image' || f.type === 'video'))

const fileActions = [
  { name: t('mobile_files.actions.open') },
  { name: t('mobile_files.actions.save') },
  { name: t('mobile_files.actions.forward') },
  { name: t('mobile_files.actions.delete'), color: 'var(--tjg-color-danger-500)' }
]

function getFileIcon(type: string): string {
  const icons: Record<string, string> = {
    document: 'mdi:file-document',
    image: 'mdi:image',
    video: 'mdi:video',
    audio: 'mdi:music'
  }
  return icons[type] || 'mdi:file'
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

function handleFileClick(file: MobileFile) {
  showToast(t('mobile_files.opening', { name: file.name }))
}

function showFileOptions(file: MobileFile) {
  selectedFile.value = file
  showOptions.value = true
}

function onActionSelect(action: FileAction) {
  if (action.name === t('mobile_files.actions.delete')) {
    files.value = files.value.filter((f) => f.id !== selectedFile.value?.id)
    showToast(t('mobile_files.deleted'))
  } else {
    showToast(`${action.name}: ${selectedFile.value?.name ?? ''}`)
  }
}
</script>

<style scoped></style>
