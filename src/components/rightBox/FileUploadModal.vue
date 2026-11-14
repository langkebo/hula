<template>
  <n-modal
    v-model:show="visible"
    :mask-closable="false"
    class="rounded-8px"
    transform-origin="center"
    role="dialog"
    aria-modal="true">
    <div class="bg-[--tjg-surface-panel] min-w-320px h-fit box-border flex flex-col select-none cursor-default">
      <n-flex :size="6" vertical>
        <MacCloseButton v-if="isMac()" class="mt-6px absolute left-6px" @click="visible = false" />

        <n-flex class="text-(14px [--tjg-text-primary]) select-none pt-6px" justify="center">
          {{ t('message.file_upload.title') }}
        </n-flex>

        <svg
          v-if="isWindows()"
          class="size-14px cursor-pointer pt-6px select-none absolute right-6px"
          @click="visible = false"
          aria-hidden="true">
          <use href="#close"></use>
        </svg>
        <span class="h-1px w-full bg-[--tjg-border-default]"></span>
      </n-flex>

      <!-- 内容 -->
      <div class="p-10px">
        <div class="max-h-400px overflow-y-auto">
          <div v-for="(file, index) in fileList" :key="fileKey(file, index)" class="flex-y-center p-12px">
            <div class="flex-shrink-0 pr-12px">
              <img
                :src="`/file/${getFileExtension(file.name)}.svg`"
                :alt="getFileExtension(file.name)"
                @error="handleIconError"
                class="size-32px object-contain" />
            </div>

            <div class="flex-1 min-w-0">
              <div
                class="text-(14px [--tjg-text-primary]) whitespace-nowrap overflow-hidden text-ellipsis pb-4px"
                :title="file.name">
                {{ file.name }}
              </div>
              <div class="text-(12px [--tjg-text-secondary])">{{ formatBytes(file.size) }}</div>
            </div>

            <div v-clickable @click="removeFile(index)" class="flex-shrink-0 pl-20px cursor-pointer">
              <svg
                class="size-20px hover:color-[--tjg-text-tertiary] transition-colors duration-200 ease-in-out"
                aria-hidden="true">
                <use href="#squareClose"></use>
              </svg>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-8px">
          <n-button quaternary :disabled="sending" @click="handleCancel">
            {{ t('message.file_upload.cancel') }}
          </n-button>
          <n-button
            secondary
            type="primary"
            :loading="sending"
            :disabled="sending || fileList.length === 0"
            @click="handleConfirm">
            {{ t('message.file_upload.send', { count: fileList.length }) }}
          </n-button>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MacCloseButton from '@/components/common/MacCloseButton.vue'
import type { UploadFile } from '@/utils/FileType'
import { isPathUploadFile } from '@/utils/FileType'
import { formatBytes } from '@/utils/Formatting'
import { isMac, isWindows } from '@/utils/PlatformConstants'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    show: boolean
    files: UploadFile[]
  }>(),
  {
    show: false,
    files: () => []
  }
)

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm', files: UploadFile[]): void
  (e: 'cancel'): void
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const fileList = ref<UploadFile[]>([])
/** 确认发送中的锁，避免双击重复触发上传 */
const sending = ref(false)

watch(
  () => props.files,
  (newFiles) => {
    fileList.value = [...newFiles]
  },
  { immediate: true }
)

// 弹窗再次打开时重置发送锁
watch(
  () => props.show,
  (show) => {
    if (show) sending.value = false
  }
)

/**
 * 列表 key：同名不同文件需可区分。
 * PathUploadFile 无 lastModified，用 path+size；浏览器 File 用 name+size+lastModified。
 */
const fileKey = (file: UploadFile, index: number): string => {
  if (isPathUploadFile(file)) return `${file.path}-${file.size}-${index}`
  return `${file.name}-${file.size}-${file.lastModified}`
}

const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || 'file'
}

// 直接复用 @/utils/Formatting 的 formatBytes

const handleIconError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = '/file/other.svg' // 默认文件图标
}

const removeFile = (index: number) => {
  fileList.value.splice(index, 1)
  // 如果文件列表为空，自动关闭弹窗
  if (fileList.value.length === 0) {
    visible.value = false
  }
}

const handleCancel = () => {
  if (sending.value) return
  visible.value = false
  emit('cancel')
}

const handleConfirm = () => {
  if (sending.value || fileList.value.length === 0) return
  sending.value = true
  emit('confirm', fileList.value)
  visible.value = false
}
</script>

<style scoped lang="scss"></style>
