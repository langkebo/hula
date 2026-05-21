import { invokeWithResult } from '@/utils/TauriInvokeHandler'

export interface OpenClawInstallStatus {
  platform: string
  state: 'installed' | 'not_installed' | 'unsupported' | string
  isInstalled: boolean
  canAutoInstall: boolean
  executablePath: string | null
  version: string | null
  docsUrl: string
  manualInstallCommand: string | null
  manualInstallSteps: string[]
  recommendedNextCommands: string[]
  notes: string[]
}

export interface OpenClawInstallResult {
  success: boolean
  alreadyInstalled: boolean
  platform: string
  commandDisplay: string
  logs: string[]
  status: OpenClawInstallStatus
}

class OpenClawInstallService {
  async detectInstallation(): Promise<OpenClawInstallStatus> {
    const result = await invokeWithResult<OpenClawInstallStatus>('detect_openclaw_installation', undefined, {
      showError: false
    })

    if (result.isErr()) {
      throw result.error
    }

    return result.value
  }

  async install(): Promise<OpenClawInstallResult> {
    const result = await invokeWithResult<OpenClawInstallResult>('install_openclaw', undefined, {
      showError: false
    })

    if (result.isErr()) {
      throw result.error
    }

    return result.value
  }
}

export const openClawInstallService = new OpenClawInstallService()
