<template>
  <n-flex data-tauri-drag-region vertical class="login-box size-full select-none !gap-0">
    <video class="w-full h-240px rounded-t-8px object-cover" autoplay loop data-tauri-drag-region>
      <source src="@/assets/video/issue.mp4" type="video/mp4" />
      <source src="@/assets/video/star.mp4" type="video/mp4" />
    </video>
    <div data-tauri-drag-region>
      <n-progress
        data-tauri-drag-region
        size="12"
        :border-radius="0"
        :color="'var(--tjg-color-primary-500)'"
        :rail-color="'var(--tjg-color-primary-100)'"
        :percentage="percentage"
        :show-indicator="false" />

      <NCarousel
        autoplay
        direction="vertical"
        :interval="3000"
        :show-dots="false"
        class="w-[90%] text-sm line-height-30px h-[30px] px-2 overflow-hidden cursor-default">
        <NCarouselItem
          data-tauri-drag-region
          v-for="(it, i) in list"
          :key="i"
          class="whitespace-nowrap align-middle text-(12px ellipsis) max-w-full box-border color-[--tjg-text-tertiary]"
          :title="it">
          {{ it }}
        </NCarouselItem>
      </NCarousel>

      <p
        v-if="errorMessage"
        class="cursor-default color-[--tjg-color-danger-500] text-center text-sm mt-4"
        role="alert"
        data-tauri-drag-region>
        {{ errorMessage }}
      </p>
      <p v-else class="cursor-default color-[--tjg-color-primary-500] text-center text-sm mt-4" data-tauri-drag-region>
        {{ t('message.update_window.updating') }} {{ percentage }}%
      </p>

      <n-flex v-if="errorMessage" justify="center" :size="12" class="mt-3">
        <n-button size="small" type="primary" :loading="updating" @click="doUpdate">
          {{ t('common.retry') }}
        </n-button>
        <n-button size="small" secondary @click="closeWindow">{{ t('common.close') }}</n-button>
      </n-flex>
    </div>
  </n-flex>
</template>
<script setup lang="tsx">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { NCarousel, NCarouselItem } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Update')

const list = ref<string[]>([])
const updating = ref(false)
const total = ref(0)
const downloaded = ref(0)
const errorMessage = ref('')
const { t } = useI18n()

/** total 为 0（服务端未返回 contentLength）或数值异常时兜底为 0，避免出现 NaN/Infinity */
const percentage = computed(() => {
  if (total.value <= 0) return 0
  const value = (downloaded.value / total.value) * 100
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
})

// https://gitee.com/api/v5/repos/llangkebo/hula/releases/tags/v${newVersion.value}?access_token=${import.meta.env.VITE_GITEE_TOKEN}

interface GiteeCommitResultStruct {
  id: number
  tag_name: string
  target_commitish: string
  prerelease: boolean
  name: string
  body: string
  author: unknown
  created_at: string
  assets: unknown
}

const fetchGiteeReleaseData = async (version: string) => {
  const apiEndpoint = new URL(`https://gitee.com/api/v5/repos/llangkebo/hula/releases/tags/v${version}`)

  apiEndpoint.search = new URLSearchParams({
    access_token: import.meta.env.VITE_GITEE_TOKEN
  }).toString()

  return await HttpClient.get<GiteeCommitResultStruct>(apiEndpoint.toString())
}

const extractCommitMessages = (releaseBody: string) => {
  const commitmessageRegex = /^\* (.+)/gm
  const matchs = releaseBody.matchAll(commitmessageRegex)
  return Array.from(matchs, (match) => match[1])
}

const setupCommitList = async (version: string) => {
  try {
    const releaseData = await fetchGiteeReleaseData(version)
    list.value = extractCommitMessages(releaseData.body)
  } catch (err) {
    logger.error(`${t('message.update_window.fetch_commit_failed', { version })}:`, err)
    list.value =
      err instanceof Error
        ? [t('message.update_window.fetch_release_error_with_reason', { reason: err.message })]
        : [t('message.update_window.fetch_release_error')]
  }
}

const closeWindow = async () => {
  try {
    await WebviewWindow.getCurrent().close()
  } catch (error) {
    logger.error('Failed to close update window:', error)
  }
}

const doUpdate = async () => {
  if (updating.value) return
  // 重试时重置进度，避免沿用上一次的下载量导致百分比跳跃
  updating.value = true
  errorMessage.value = ''
  total.value = 0
  downloaded.value = 0
  try {
    const update = await check()
    if (!update?.available) {
      logger.warn('No update available in update window')
      errorMessage.value = t('message.update_window.no_update')
      return
    }

    await setupCommitList(update.version)

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total.value = event.data.contentLength ? event.data.contentLength : 0
          break
        case 'Progress':
          downloaded.value += event.data.chunkLength
          break
        case 'Finished':
          break
      }
    })
    try {
      await relaunch()
    } catch (error) {
      logger.error('relaunch failed:', error)
      errorMessage.value = t('message.update_window.relaunch_failed')
    }
  } catch (error) {
    logger.error('update failed:', error)
    errorMessage.value =
      error instanceof Error
        ? t('message.update_window.update_failed_with_reason', { reason: error.message })
        : t('message.update_window.update_failed')
  } finally {
    updating.value = false
  }
}

onMounted(async () => {
  await doUpdate()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
</style>
