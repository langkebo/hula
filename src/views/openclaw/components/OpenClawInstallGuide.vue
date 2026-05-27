<template>
  <div class="install-guide flex flex-col items-center justify-center size-full p-24px gap-20px">
    <!-- 检测中 -->
    <template v-if="step === 'checking'">
      <n-spin size="large" />
      <p class="text-14px color-[--hula-text-secondary]">{{ t('ai_assistant.openclaw.install.checking') }}</p>
    </template>

    <!-- 未安装 -->
    <template v-else-if="step === 'not-installed'">
      <svg class="size-64px color-[--hula-text-quaternary]">
        <use href="#robot" />
      </svg>
      <div class="text-center max-w-400px">
        <h3 class="text-18px font-semibold color-[--text-color] mb-8px">
          {{ t('ai_assistant.openclaw.install.title') }}
        </h3>
        <p class="text-14px color-[--hula-text-secondary] leading-6 mb-16px">
          {{ t('ai_assistant.openclaw.install.description') }}
        </p>

        <!-- 安装步骤 -->
        <n-steps vertical :current="installStepCurrent" class="text-left">
          <n-step
            :title="t('ai_assistant.openclaw.install.step1_title')"
            :description="t('ai_assistant.openclaw.install.step1_desc')" />
          <n-step
            :title="t('ai_assistant.openclaw.install.step2_title')"
            :description="t('ai_assistant.openclaw.install.step2_desc')" />
          <n-step
            :title="t('ai_assistant.openclaw.install.step3_title')"
            :description="t('ai_assistant.openclaw.install.step3_desc')" />
        </n-steps>

        <div class="flex gap-12px mt-20px justify-center">
          <n-button type="primary" @click="openDownloadPage">
            <template #icon>
              <svg class="size-16px"><use href="#download" /></svg>
            </template>
            {{ downloadInfo.label }}
          </n-button>
          <n-button @click="recheck">
            {{ t('ai_assistant.openclaw.install.recheck') }}
          </n-button>
        </div>
      </div>
    </template>

    <!-- 安装中 -->
    <template v-else-if="step === 'installing'">
      <svg class="size-64px color-[--hula-color-primary-500] animate-pulse">
        <use href="#robot" />
      </svg>
      <div class="text-center max-w-400px">
        <h3 class="text-18px font-semibold color-[--text-color] mb-8px">
          {{ t('ai_assistant.openclaw.install.installing_title') }}
        </h3>
        <p class="text-14px color-[--hula-text-secondary] leading-6 mb-16px">
          {{ t('ai_assistant.openclaw.install.installing_desc') }}
        </p>
        <n-button type="primary" @click="recheck">
          {{ t('ai_assistant.openclaw.install.recheck') }}
        </n-button>
      </div>
    </template>

    <!-- 配置中 -->
    <template v-else-if="step === 'configuring'">
      <svg class="size-64px color-[--hula-color-primary-500]">
        <use href="#robot" />
      </svg>
      <div class="text-center max-w-400px">
        <h3 class="text-18px font-semibold color-[--text-color] mb-8px">
          {{ t('ai_assistant.openclaw.install.config_title') }}
        </h3>
        <p class="text-14px color-[--hula-text-secondary] leading-6 mb-16px">
          {{ t('ai_assistant.openclaw.install.config_desc') }}
        </p>

        <div class="config-steps text-left bg-[--hula-surface-panel-muted] rounded-8px p-16px mb-16px">
          <ol class="list-decimal list-inside text-13px color-[--hula-text-secondary] space-y-8px">
            <li>{{ t('ai_assistant.openclaw.install.config_step1') }}</li>
            <li>{{ t('ai_assistant.openclaw.install.config_step2') }}</li>
            <li>{{ t('ai_assistant.openclaw.install.config_step3') }}</li>
            <li>{{ t('ai_assistant.openclaw.install.config_step4') }}</li>
          </ol>
        </div>

        <div class="flex gap-12px justify-center">
          <n-button type="primary" @click="openSettings">
            {{ t('ai_assistant.openclaw.install.open_settings') }}
          </n-button>
          <n-button @click="recheck">
            {{ t('ai_assistant.openclaw.install.recheck') }}
          </n-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useOpenClawInstaller } from '@/composables/openclaw/useOpenClawInstaller'

const emit = defineEmits<{
  openSettings: []
  ready: []
}>()

const { t } = useI18n()
const { step, downloadInfo, checkInstallation, openDownloadPage } = useOpenClawInstaller()

const installStepCurrent = computed(() => {
  if (step.value === 'not-installed') return 1
  if (step.value === 'installing') return 2
  if (step.value === 'configuring') return 3
  return 1
})

async function recheck() {
  const result = await checkInstallation()
  if (result.installed) {
    emit('ready')
  }
}

function openSettings() {
  emit('openSettings')
}

onMounted(() => {
  checkInstallation()
})
</script>
