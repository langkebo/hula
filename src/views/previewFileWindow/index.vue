<template>
  <div class="size-full bg-[--right-bg-color]">
    <ActionBar :shrink="false" :current-label="currentWindowLabel" />
    <n-scrollbar
      style="max-height: calc(100vh)"
      class="w-full box-border bg-[--tjg-surface-panel] rounded-b-8px border-(solid 1px [--tjg-border-default])">
      <div class="flex flex-col gap-4 bg-[--tjg-surface-subtle]">
        <VueOfficeDocx v-if="isShowWord" :src="resourceSrc" style="height: 100vh" />

        <VueOfficePdf v-else-if="isShowPdf" :src="resourceSrc" style="height: 95vh" />

        <VueOfficeExcel v-else-if="isShowExcel" :src="resourceSrc" style="height: 95vh" />

        <VueOfficePptx v-else-if="isShowPpt" :src="resourceSrc" style="height: 95vh" />

        <EmptyState
          v-else
          illustration="no-results"
          :title="t('fileManager.preview.no_document')"
          :description="t('fileManager.preview.no_document_desc')" />
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { merge } from 'es-toolkit'
import type { FileTypeResult } from 'file-type'
import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { useWindow } from '@/composables/common/useWindow'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { getFile } from '@/utils/PathUtil'

const { t } = useI18n()

const logger = createLogger('PreviewFile')

const currentWindowLabel = computed(() => (hasTauriRuntime() ? WebviewWindow.getCurrent().label : ''))

const VueOfficeDocx = defineAsyncComponent(async () => {
  await import('@vue-office/docx/lib/v3/index.css')
  return import('@vue-office/docx/lib/v3/vue-office-docx.mjs')
})

const VueOfficeExcel = defineAsyncComponent(async () => {
  await import('@vue-office/excel/lib/v3/index.css')
  return import('@vue-office/excel/lib/v3/vue-office-excel.mjs')
})

const VueOfficePdf = defineAsyncComponent(async () => import('@vue-office/pdf/lib/v3/vue-office-pdf.mjs'))
const VueOfficePptx = defineAsyncComponent(async () => import('@vue-office/pptx/lib/v3/vue-office-pptx.mjs'))

type PayloadData = {
  userId: string
  roomId: string
  messageId: string
  resourceFile: {
    fileName: string
    absolutePath: string | undefined
    nativePath: string | undefined
    url: string
    type: FileTypeResult | undefined
    localExists: boolean
  }
}

const uiData = reactive({
  payload: {
    messageId: '',
    userId: '',
    roomId: '',
    resourceFile: {
      fileName: '',
      absolutePath: '',
      nativePath: '',
      url: '',
      localExists: false,
      type: {
        ext: '',
        mime: ''
      }
    }
  } as PayloadData,

  file: new File([], ''), // 只有在找到本地文件时才用它
  fileBuffer: [] as unknown as ArrayBuffer,
  fileLoading: false
})

const resourceSrc = computed(() => {
  const { resourceFile } = uiData.payload
  const { localExists, url } = resourceFile

  // 优先使用本地已加载的文件 buffer
  if (localExists && uiData.fileBuffer) {
    return uiData.fileBuffer
  }

  // 否则使用远程地址
  return url
})

const fileExt = computed(() => uiData.payload.resourceFile.type?.ext || '')
const localExists = computed(() => uiData.payload.resourceFile.localExists)

const isShowWord = computed(() => {
  const match = ['doc', 'docx', 'cfb'].includes(fileExt.value)
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowPdf = computed(() => {
  const match = fileExt.value === 'pdf'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowExcel = computed(() => {
  const match = fileExt.value === 'xlsx'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowPpt = computed(() => {
  const match = fileExt.value === 'pptx'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const updateFile = async (absolutePath: string, exists: boolean) => {
  try {
    if (exists) {
      uiData.fileLoading = false // 初始设为 false，确保状态干净

      // 文件存在本地就更新
      const file = await getFile(absolutePath)
      uiData.file = file.file

      const buffer = await file.file.arrayBuffer()
      uiData.fileBuffer = buffer

      uiData.fileLoading = true
      logger.debug('已更新本地文件 ', file.file.size, uiData.file.size)
    } else {
      uiData.fileLoading = true
    }
  } catch (error) {
    logger.error('读取文件时出错：', error)
    uiData.fileLoading = false
  }
}

const { getWindowPayload } = useWindow()
const { addListener } = useTauriListener()

onMounted(async () => {
  if (!hasTauriRuntime()) return
  const webviewWindow = getCurrentWebviewWindow()
  const label = webviewWindow.label

  await addListener(
    listen<{ payload: PayloadData }>(`${label}:update`, (event) => {
      const payload: PayloadData = event.payload.payload
      logger.debug('payload更新：', payload)

      merge(uiData.payload, payload)

      updateFile(payload.resourceFile.absolutePath || '', payload.resourceFile.localExists)
    }),
    'preview-file-update'
  )

  try {
    const payload = await getWindowPayload<PayloadData>(label)
    logger.debug('获取的载荷信息：', payload)

    merge(uiData.payload, payload)

    updateFile(payload.resourceFile.absolutePath || '', payload.resourceFile.localExists)
  } catch (error) {
    logger.error('获取错误：', error)
  }

  await webviewWindow.show()
})
</script>

<style scoped lang="scss"></style>
