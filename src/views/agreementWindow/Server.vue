<template>
  <div class="agreement-container">
    <!-- 顶部操作栏 -->
    <ActionBar :isDrag="false" :max-w="false" :min-w="false" :shrink="false" :current-label="currentWindowLabel" />

    <!-- 协议内容 -->
    <div class="agreement-content">
      <div class="agreement-header">
        <h1>{{ t('agreement.server.header.title') }}</h1>
        <p class="update-time">{{ t('agreement.server.header.updatedAt') }}</p>
      </div>

      <div class="agreement-body">
        <section v-for="section in serverSections" :key="section.title">
          <h2>{{ section.title }}</h2>

          <p v-for="(paragraph, pIndex) in section.paragraphs" :key="`paragraph-${pIndex}`">
            {{ paragraph }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { hasTauriRuntime } from '@/utils/AppHarness'

type AgreementSection = {
  title: string
  paragraphs?: string[]
}

const { t, tm } = useI18n()

const currentWindowLabel = computed(() => (hasTauriRuntime() ? WebviewWindow.getCurrent().label : ''))
const serverSections = computed(() => tm('agreement.server.sections') as AgreementSection[])

onMounted(async () => {
  if (hasTauriRuntime()) {
    await getCurrentWebviewWindow().show()
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/agreement';
</style>
