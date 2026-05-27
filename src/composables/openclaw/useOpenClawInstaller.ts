import { invoke } from '@tauri-apps/api/core'
import { computed, readonly, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('OpenClawInstaller')

export interface OpenClawStatus {
  installed: boolean
  path: string | null
  version: string | null
  osType: string
}

export type InstallStep = 'checking' | 'not-installed' | 'installing' | 'configuring' | 'ready'

const OPENCLAW_DOWNLOAD_URLS: Record<string, { url: string; label: string }> = {
  macos: {
    url: 'https://github.com/openclaw/openclaw/releases/latest/download/OpenClaw.dmg',
    label: 'Download OpenClaw for macOS (.dmg)'
  },
  windows: {
    url: 'https://github.com/openclaw/openclaw/releases/latest/download/OpenClaw-Setup.exe',
    label: 'Download OpenClaw for Windows (.exe)'
  },
  linux: {
    url: 'https://github.com/openclaw/openclaw/releases/latest/download/openclaw-linux-x64.tar.gz',
    label: 'Download OpenClaw for Linux (.tar.gz)'
  }
}

const OPENCLAW_DEFAULT_ENDPOINT = 'http://127.0.0.1:8080/v1'

export function useOpenClawInstaller() {
  const status = ref<OpenClawStatus | null>(null)
  const step = ref<InstallStep>('checking')
  const checking = ref(false)

  const isInstalled = computed(() => status.value?.installed ?? false)
  const osType = computed(() => status.value?.osType ?? 'unknown')
  const downloadInfo = computed(() => OPENCLAW_DOWNLOAD_URLS[osType.value] ?? OPENCLAW_DOWNLOAD_URLS.linux)

  async function checkInstallation(): Promise<OpenClawStatus> {
    checking.value = true
    step.value = 'checking'
    try {
      const result = await invoke<OpenClawStatus>('check_openclaw_installation')
      status.value = result
      step.value = result.installed ? 'ready' : 'not-installed'
      logger.info('OpenClaw 安装状态:', result)
      return result
    } catch (error) {
      logger.error('检测 OpenClaw 安装状态失败:', error)
      const fallback: OpenClawStatus = { installed: false, path: null, version: null, osType: 'unknown' }
      status.value = fallback
      step.value = 'not-installed'
      return fallback
    } finally {
      checking.value = false
    }
  }

  function openDownloadPage() {
    window.open(downloadInfo.value.url, '_blank')
  }

  function markAsInstalling() {
    step.value = 'installing'
  }

  function markAsConfiguring() {
    step.value = 'configuring'
  }

  function markAsReady() {
    step.value = 'ready'
  }

  return {
    status: readonly(status),
    step: readonly(step),
    checking: readonly(checking),
    isInstalled,
    osType,
    downloadInfo,
    defaultEndpoint: OPENCLAW_DEFAULT_ENDPOINT,
    checkInstallation,
    openDownloadPage,
    markAsInstalling,
    markAsConfiguring,
    markAsReady
  }
}
