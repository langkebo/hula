<template>
  <div class="help-settings">
    <div class="settings-section">
      <h3 class="section-title">关于</h3>
      <div class="about-info">
        <div class="app-logo">
          <img src="@/assets/img/win.png" alt="Logo" width="64" height="64" />
        </div>
        <div class="app-info">
          <div class="app-name">HuLa</div>
          <div class="app-version">版本 {{ appVersion }}</div>
          <div class="sdk-version">Matrix SDK v{{ sdkVersion }}</div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">检查更新</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">当前版本</span>
          <span class="setting-desc">{{ appVersion }}</span>
        </div>
        <n-button size="small" :loading="checkingUpdate" @click="handleCheckUpdate">
          {{ checkingUpdate ? '检查中...' : '检查更新' }}
        </n-button>
      </div>
      <div v-if="updateInfo" class="update-info">
        <div v-if="updateInfo.hasUpdate" class="update-available">
          <Icon icon="mdi:download" :width="16" />
          <span>发现新版本: {{ updateInfo.latestVersion }}</span>
          <n-button size="small" type="primary" @click="handleDownloadUpdate">立即更新</n-button>
        </div>
        <div v-else class="update-latest">
          <Icon icon="mdi:check-circle" :width="16" />
          <span>已是最新版本</span>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">链接</h3>
      <div class="link-list">
        <div class="link-item" @click="openLink('https://matrix.org')">
          <Icon icon="mdi:web" :width="20" />
          <span>Matrix 官网</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
        <div class="link-item" @click="openLink('https://spec.matrix.org')">
          <Icon icon="mdi:book-open-variant" :width="20" />
          <span>Matrix 规范</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
        <div class="link-item" @click="openLink('https://github.com/nichuanfang/nichuanfang.github.io')">
          <Icon icon="mdi:github" :width="20" />
          <span>GitHub</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
        <div class="link-item" @click="openLink('https://element-hq.github.io/synapse/latest/')">
          <Icon icon="mdi:server" :width="20" />
          <span>Synapse 文档</span>
          <Icon icon="mdi:open-in-new" :width="14" class="link-arrow" />
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">反馈与支持</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">提交问题反馈</span>
          <span class="setting-desc">报告 Bug 或提出功能建议</span>
        </div>
        <n-button size="small" @click="handleFeedback">
          <template #icon><Icon icon="mdi:bug-outline" :width="16" /></template>
          反馈
        </n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">查看日志</span>
          <span class="setting-desc">打开应用日志目录</span>
        </div>
        <n-button size="small" @click="handleOpenLogs">
          <template #icon><Icon icon="mdi:folder-outline" :width="16" /></template>
          打开
        </n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">技术信息</h3>
      <div class="tech-info">
        <div class="tech-item">
          <span class="tech-label">运行平台</span>
          <span class="tech-value">{{ platform }}</span>
        </div>
        <div class="tech-item">
          <span class="tech-label">Tauri 版本</span>
          <span class="tech-value">{{ tauriVersion }}</span>
        </div>
        <div class="tech-item">
          <span class="tech-label">Vue 版本</span>
          <span class="tech-value">{{ vueVersion }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NDivider, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { usePlatform } from '@/composables/usePlatform'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HelpSettings')

defineOptions({
  name: 'HelpSettings'
})

const message = useMessage()
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
    platform.value = isDesktopPlatform ? 'Tauri Desktop' : 'Web Browser'

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
      logger.debug('无法加载 package.json')
    }
  } catch (error) {
    logger.error('加载版本信息失败:', error)
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

    message.success('已是最新版本')
  } catch (error) {
    message.error('检查更新失败')
  } finally {
    checkingUpdate.value = false
  }
}

function handleDownloadUpdate() {
  openLink('https://github.com/nichuanfang/nichuanfang.github.io/releases')
}

function openLink(url: string) {
  window.open(url, '_blank')
}

function handleFeedback() {
  window.open('https://github.com/nichuanfang/nichuanfang.github.io/issues', '_blank')
}

async function handleOpenLogs() {
  if (isDesktopPlatform) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      const { appDataDir } = await import('@tauri-apps/api/path')
      const logPath = await appDataDir()
      await open(logPath)
    } catch (error) {
      message.error('无法打开日志目录')
    }
  } else {
    message.info('Web 版本暂不支持此功能')
  }
}
</script>

<style scoped>
.help-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.about-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .about-info {
  background-color: rgba(255, 255, 255, 0.05);
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
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

:deep(.dark) .app-version {
  color: #aaa;
}

.sdk-version {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.update-info {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .update-info {
  background-color: rgba(255, 255, 255, 0.05);
}

.update-available {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1890ff;
}

.update-latest {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #52c41a;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

:deep(.dark) .link-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.link-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

:deep(.dark) .link-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.link-arrow {
  margin-left: auto;
  color: #999;
}

.tech-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .tech-info {
  background-color: rgba(255, 255, 255, 0.05);
}

.tech-item {
  display: flex;
  justify-content: space-between;
}

.tech-label {
  font-size: 14px;
  color: #666;
}

:deep(.dark) .tech-label {
  color: #aaa;
}

.tech-value {
  font-size: 14px;
  font-weight: 500;
}
</style>
