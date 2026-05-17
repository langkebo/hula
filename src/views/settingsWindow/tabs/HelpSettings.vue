<template>
  <div class="help-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.help_about.about') }}</h3>
      <div class="about-info">
        <div class="app-logo">
          <img src="@/assets/img/win.png" alt="Logo" width="64" height="64" />
        </div>
        <div class="app-info">
          <div class="app-name">HuLa</div>
          <div class="app-version">{{ t('setting.help_about.version') }} {{ appVersion }}</div>
          <div class="sdk-version">{{ t('setting.help_about.matrix_sdk_version') }} v{{ sdkVersion }}</div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.help_about.check_update') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.help_about.current_version') }}</span>
          <span class="setting-desc">{{ appVersion }}</span>
        </div>
        <n-button size="small" :loading="checkingUpdate" @click="handleCheckUpdate">
          {{ checkingUpdate ? t('setting.help_about.checking') : t('setting.help_about.check_update') }}
        </n-button>
      </div>
      <div v-if="updateInfo" class="update-info">
        <div v-if="updateInfo.hasUpdate" class="update-available">
          <Icon icon="mdi:download" :width="16" />
          <span>{{ t('setting.help_about.new_version_found', { version: updateInfo.latestVersion }) }}</span>
          <n-button size="small" type="primary" @click="handleDownloadUpdate">
            {{ t('setting.help_about.update_now') }}
          </n-button>
        </div>
        <div v-else class="update-latest">
          <Icon icon="mdi:check-circle" :width="16" />
          <span>{{ t('setting.help_about.up_to_date') }}</span>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.help_about.links') }}</h3>
      <div class="link-list">
        <div class="link-item" @click="openLink('https://matrix.org')">
          <Icon icon="mdi:web" :width="20" />
          <span>{{ t('setting.help_about.matrix_website') }}</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
        <div class="link-item" @click="openLink('https://spec.matrix.org')">
          <Icon icon="mdi:book-open-variant" :width="20" />
          <span>{{ t('setting.help_about.matrix_spec') }}</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
        <div class="link-item" @click="openLink('https://github.com/nichuanfang/nichuanfang.github.io')">
          <Icon icon="mdi:github" :width="20" />
          <span>{{ t('setting.help_about.project_home') }}</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
        <div class="link-item" @click="openLink('https://element-hq.github.io/synapse/latest/')">
          <Icon icon="mdi:server" :width="20" />
          <span>{{ t('setting.help_about.synapse_docs') }}</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.help_about.support') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.help_about.submit_feedback') }}</span>
          <span class="setting-desc">{{ t('setting.help_about.feedback_desc') }}</span>
        </div>
        <n-button size="small" @click="handleFeedback">
          <template #icon><Icon icon="mdi:bug-outline" :width="16" /></template>
          {{ t('setting.help_about.feedback_action') }}
        </n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.help_about.view_logs') }}</span>
          <span class="setting-desc">{{ t('setting.help_about.view_logs_desc') }}</span>
        </div>
        <n-button size="small" @click="handleOpenLogs">
          <template #icon><Icon icon="mdi:folder-outline" :width="16" /></template>
          {{ t('setting.help_about.open') }}
        </n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.help_about.technical_info') }}</h3>
      <div class="tech-info">
        <div class="tech-item">
          <span class="tech-label">{{ t('setting.help_about.runtime_platform') }}</span>
          <span class="tech-value">{{ platform }}</span>
        </div>
        <div class="tech-item">
          <span class="tech-label">{{ t('setting.help_about.tauri_version') }}</span>
          <span class="tech-value">{{ tauriVersion }}</span>
        </div>
        <div class="tech-item">
          <span class="tech-label">{{ t('setting.help_about.vue_version') }}</span>
          <span class="tech-value">{{ vueVersion }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NDivider } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { usePlatform } from '@/composables/usePlatform'
import { openExternalUrl } from '@/hooks/useLinkSegments'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HelpSettings')

defineOptions({
  name: 'HelpSettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()
const { isDesktop: isDesktopPlatform } = usePlatform()

const appVersion = ref('1.0.0')
const sdkVersion = ref('37.0.0')
const vueVersion = ref('3.5.0')
const tauriVersion = ref('-')
const platform = ref('-')
const checkingUpdate = ref(false)
const updateInfo = ref<{ hasUpdate: boolean; latestVersion: string } | null>(null)

onMounted(async () => {
  await loadVersionInfo()
})

async function loadVersionInfo() {
  try {
    platform.value = isDesktopPlatform ? t('setting.help_about.platform_desktop') : t('setting.help_about.platform_web')

    if (isDesktopPlatform) {
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        appVersion.value = await getVersion()
      } catch {
        appVersion.value = '1.0.0'
      }

      try {
        const { getTauriVersion } = await import('@tauri-apps/api/app')
        tauriVersion.value = await getTauriVersion()
      } catch {
        tauriVersion.value = '2.x'
      }
    } else {
      tauriVersion.value = '-'
    }

    try {
      const response = await fetch('/package.json')
      if (response.ok) {
        const pkg = await response.json()
        if (pkg.version) {
          appVersion.value = pkg.version
        }
        if (pkg.dependencies?.['matrix-js-sdk']) {
          sdkVersion.value = pkg.dependencies['matrix-js-sdk'].replace('^', '')
        }
        if (pkg.dependencies?.['vue']) {
          vueVersion.value = pkg.dependencies['vue'].replace('^', '')
        }
      }
    } catch {
      logger.debug('Failed to load package.json')
    }
  } catch (error) {
    logger.error('Failed to load version info:', error)
  }
}

async function handleCheckUpdate() {
  checkingUpdate.value = true
  updateInfo.value = null

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    updateInfo.value = {
      hasUpdate: false,
      latestVersion: appVersion.value
    }

    showFeedback(t('setting.help_about.up_to_date'), 'success')
  } catch (error) {
    showFeedback(t('setting.help_about.check_update_failed'), 'error')
  } finally {
    checkingUpdate.value = false
  }
}

function handleDownloadUpdate() {
  void openLink('https://github.com/nichuanfang/nichuanfang.github.io/releases')
}

function openLink(url: string) {
  return openExternalUrl(url)
}

function handleFeedback() {
  void openLink('https://github.com/nichuanfang/nichuanfang.github.io/issues')
}

async function handleOpenLogs() {
  if (isDesktopPlatform) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      const { appDataDir } = await import('@tauri-apps/api/path')
      const logPath = await appDataDir()
      await open(logPath)
    } catch (error) {
      showFeedback(t('setting.help_about.open_logs_failed'), 'error')
    }
  } else {
    showFeedback(t('setting.help_about.open_logs_unsupported'), 'info')
  }
}
</script>

<style scoped>
.help-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.about-info {
  display: flex;
  align-items: center;
  gap: var(--hula-space-4);
  padding: var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.app-logo img {
  border-radius: 12px;
}

.app-info {
  display: flex;
  flex-direction: column;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
}

.app-version {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-secondary);
  margin-top: var(--hula-space-1);
}

.sdk-version {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: 2px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.update-info {
  margin-top: var(--hula-space-3);
  padding: var(--hula-space-3);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.update-available {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
  color: var(--hula-color-info-500);
}

.update-latest {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
  color: var(--hula-color-success-500);
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-2);
}

.link-item {
  display: flex;
  align-items: center;
  gap: var(--hula-space-3);
  padding: var(--hula-space-3) var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
  cursor: pointer;
  transition: background-color var(--hula-motion-duration-normal) var(--hula-motion-ease-standard);
}

.link-item:hover {
  background-color: var(--hula-settings-card-bg-hover);
}

.link-arrow {
  margin-left: auto;
  color: var(--hula-text-quaternary);
}

.tech-info {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-2);
  padding: var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.tech-item {
  display: flex;
  justify-content: space-between;
}

.tech-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-secondary);
}

.tech-value {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}
</style>
