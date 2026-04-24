<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.help_about.about') }}</span>

      <n-flex class="item p-12px" vertical :size="16" align="center">
        <div class="app-logo">
          <svg class="size-64px"><use href="#hula-logo"></use></svg>
        </div>
        <n-flex vertical align="center" :size="8">
          <span class="text-20px font-bold">HuLa</span>
          <span class="text-(14px [--color-text-secondary])">{{ t('setting.help_about.version') }}: {{ appVersion }}</span>
          <n-tag size="small" type="success">stable</n-tag>
        </n-flex>

        <n-flex :size="12">
          <n-button size="small" secondary @click="handleCheckUpdate">
            {{ t('setting.help_about.check_update') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.help_about.links') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <template v-for="(link, index) in links" :key="link.name">
          <n-flex
            align="center"
            justify="space-between"
            class="py-10px cursor-pointer hover-bg"
            @click="openLink(link.url)">
            <n-flex align="center" :size="12">
              <svg class="size-18px"><use :href="link.icon"></use></svg>
              <span>{{ link.name }}</span>
            </n-flex>
            <svg class="size-14px text-[--color-text-quaternary]"><use href="#open-in-new"></use></svg>
          </n-flex>
          <span v-if="index < links.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
        </template>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.help_about.support') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <template v-for="(item, index) in supportItems" :key="item.name">
          <n-flex
            align="center"
            justify="space-between"
            class="py-10px cursor-pointer hover-bg"
            @click="handleSupportAction(item.action)">
            <n-flex align="center" :size="12">
              <svg class="size-18px"><use :href="item.icon"></use></svg>
              <span>{{ item.name }}</span>
            </n-flex>
            <svg class="size-14px text-[--color-text-quaternary]"><use href="#open-in-new"></use></svg>
          </n-flex>
          <span v-if="index < supportItems.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
        </template>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.help_about.technical_info') }}</span>

      <n-flex class="item p-12px" :size="8" vertical>
        <n-flex justify="space-between">
          <span class="text-(12px [--color-text-secondary])">{{ t('setting.help_about.platform') }}</span>
          <span class="text-(12px [--color-text-secondary])">Tauri Desktop v{{ tauriVersion }}</span>
        </n-flex>
        <n-flex justify="space-between">
          <span class="text-(12px [--color-text-secondary])">Rust</span>
          <span class="text-(12px [--color-text-secondary])">v{{ rustVersion }}</span>
        </n-flex>
        <n-flex justify="space-between">
          <span class="text-(12px [--color-text-secondary])">{{ t('setting.help_about.vue_version') }}</span>
          <span class="text-(12px [--color-text-secondary])">v{{ vueVersion }}</span>
        </n-flex>
        <n-flex justify="space-between">
          <span class="text-(12px [--color-text-secondary])">{{ t('setting.help_about.build_number') }}</span>
          <span class="text-(12px [--color-text-secondary])">#{{ buildNumber }}</span>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.help_about.legal') }}</span>

      <n-flex class="item p-12px" :size="12" justify="center">
        <n-flex :size="24">
          <n-button text @click="openLink('/legal/terms.html')">
            {{ t('setting.help_about.terms_of_service') }}
          </n-button>
          <span class="text-[--color-text-quaternary]">|</span>
          <n-button text @click="openLink('/legal/privacy.html')">
            {{ t('setting.help_about.privacy_policy') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { NButton, NTag, NFlex, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { invoke } from '@tauri-apps/api/core'

const { t } = useI18n()
const message = useMessage()

const appVersion = '1.0.1'
const tauriVersion = '1.6'
const rustVersion = '1.75'
const vueVersion = '3.5'
const buildNumber = '2024.01.15.1'

const links = [
  { name: t('setting.help_about.matrix_website'), icon: '#web', url: 'https://matrix.org' },
  { name: t('setting.help_about.matrix_spec'), icon: '#file-document', url: 'https://spec.matrix.org' },
  { name: t('setting.help_about.project_home'), icon: '#github', url: 'https://gitee.com/llangkebo/hula' },
  { name: t('setting.help_about.synapse_docs'), icon: '#book-open', url: 'https://element-hq.github.io/synapse/latest' }
]

const supportItems = [
  { name: t('setting.help_about.report_issue'), icon: '#bug', action: 'issue' },
  { name: t('setting.help_about.view_logs'), icon: '#folder', action: 'logs' },
  { name: t('setting.help_about.export_logs'), icon: '#download', action: 'export' },
  { name: t('setting.help_about.run_diagnostics'), icon: '#wrench', action: 'diagnostics' },
  { name: t('setting.help_about.view_licenses'), icon: '#certificate', action: 'licenses' }
]

const openLink = (url: string) => {
  if (url.startsWith('http')) {
    invoke('open_url', { url })
  }
}

const handleCheckUpdate = () => {
  message.info(t('setting.help_about.up_to_date'))
}

const handleSupportAction = (action: string) => {
  switch (action) {
    case 'issue':
      invoke('open_url', { url: 'https://gitee.com/llangkebo/hula/issues' })
      break
    case 'logs':
      message.info(t('setting.help_about.viewing_logs'))
      break
    case 'export':
      message.info(t('setting.help_about.exporting_logs'))
      break
    case 'diagnostics':
      message.info(t('setting.help_about.running_diagnostics'))
      break
    case 'licenses':
      message.info(t('setting.help_about.viewing_licenses'))
      break
  }
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}

.app-logo {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #13987f 0%, #17a2b8 100%);
  border-radius: 16px;
  color: white;
}

.hover-bg {
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.03);
  }

  :deep(.dark) & {
    &:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
  }
}
</style>
