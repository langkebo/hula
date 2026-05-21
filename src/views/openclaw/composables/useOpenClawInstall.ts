import { ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type OpenClawInstallStatus, openClawInstallService } from '@/services/openclaw'
import { createLogger } from '@/utils/Logger'

const _logger = createLogger('OpenClawInstall')

export function useOpenClawInstall(translate: (key: string, params?: Record<string, unknown>) => string) {
  const { showFeedback } = useActionFeedback()

  const installStatus = ref<OpenClawInstallStatus | null>(null)
  const installStatusLoading = ref(false)
  const installingOpenClaw = ref(false)
  const installErrorMessage = ref('')
  const installLogs = ref<string[]>([])

  const loadInstallStatus = async () => {
    installStatusLoading.value = true
    installErrorMessage.value = ''
    try {
      installStatus.value = await openClawInstallService.detectInstallation()
    } catch (error) {
      installErrorMessage.value =
        error instanceof Error ? error.message : translate('ai_assistant.robot.openclaw_detect_failed')
    } finally {
      installStatusLoading.value = false
    }
  }

  const handleInstallOpenClaw = async (onInstallSuccess?: () => void) => {
    installingOpenClaw.value = true
    installErrorMessage.value = ''
    installLogs.value = []
    try {
      const result = await openClawInstallService.install()
      installStatus.value = result.status
      installLogs.value = result.logs
      if (result.success) {
        showFeedback(
          result.alreadyInstalled
            ? translate('ai_assistant.robot.openclaw_already_installed')
            : translate('ai_assistant.robot.openclaw_install_success'),
          'success'
        )
        if (result.status.isInstalled) {
          onInstallSuccess?.()
        }
      } else {
        installErrorMessage.value = translate('ai_assistant.robot.openclaw_install_incomplete')
      }
    } catch (e) {
      installErrorMessage.value =
        e instanceof Error ? e.message : translate('ai_assistant.robot.openclaw_install_failed')
    } finally {
      installingOpenClaw.value = false
      await loadInstallStatus()
    }
  }

  return {
    installStatus,
    installStatusLoading,
    installingOpenClaw,
    installErrorMessage,
    installLogs,
    loadInstallStatus,
    handleInstallOpenClaw
  }
}
