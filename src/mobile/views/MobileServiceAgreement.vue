<template>
  <MobileLayout :safeAreaTop="true" class="overflow-hidden" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('login.service_agreement_title')" />

    <div class="agreement-container">
      <!-- 协议内容 -->
      <div class="agreement-content">
        <div class="agreement-header">
          <h1>{{ serverHeader.title }}</h1>
          <p class="update-time">{{ serverHeader.updatedAt }}</p>
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
  </MobileLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type AgreementSection = {
  title: string
  paragraphs?: string[]
}

type AgreementHeader = {
  title: string
  updatedAt: string
}

const { t, tm } = useI18n()

const serverHeader = computed(() => tm('agreement.server.header') as AgreementHeader)
const serverSections = computed(() => tm('agreement.server.sections') as AgreementSection[])
</script>

<style scoped lang="scss">
.agreement-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--tjg-surface-panel);
  user-select: none;
  -webkit-user-select: none;
}

.agreement-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;

  .agreement-header {
    text-align: center;
    margin-bottom: 30px;

    h1 {
      font-size: 24px;
      font-weight: bold;
      color: var(--tjg-text-primary);
      margin-bottom: 10px;
    }

    .update-time {
      font-size: 14px;
      color: var(--tjg-text-secondary);
    }
  }

  .agreement-body {
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.6;

    section {
      margin-bottom: 25px;

      h2 {
        font-size: 18px;
        font-weight: bold;
        color: var(--tjg-text-primary);
        width: fit-content;
        margin-bottom: 15px;
        border-bottom: 2px solid color-mix(in srgb, var(--tjg-brand) 56%, transparent);
        padding-bottom: 5px;
      }

      p {
        font-size: 14px;
        color: var(--tjg-text-secondary);
        margin-bottom: 10px;
        text-indent: 2em;
      }
    }
  }
}

/* 滚动条样式 */
.agreement-content::-webkit-scrollbar {
  width: 6px;
}

.agreement-content::-webkit-scrollbar-track {
  background: var(--right-bg-color);
  border-radius: 3px;
}

.agreement-content::-webkit-scrollbar-thumb {
  background: var(--tjg-text-disabled);
  border-radius: 3px;
}

.agreement-content::-webkit-scrollbar-thumb:hover {
  background: var(--tjg-text-tertiary);
}

:deep(.action-close) {
  svg {
    color: var(--tjg-text-primary);
  }
}
</style>
