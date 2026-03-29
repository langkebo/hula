import { ref } from 'vue'
import { useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { reportService, ReportReason, type ReportRequest } from '@/services/matrix/MatrixReportService'

export function useReportDialog() {
  const { t } = useI18n()
  const dialog = useDialog()
  const isReporting = ref(false)

  async function reportUser(userId: string, reason?: ReportReason) {
    const selectedReason = ref(reason)
    const result = await dialog.warning({
      title: t('report.title'),
      content: () => <div>{t('report.select_reason')}</div>,
      action: () => (
        <div class="p-16px">
          <n-space vertical>
            <n-select
              v-model:value={selectedReason.value}
              placeholder={t('report.placeholder')}
              options={[
                { label: t('report.sexual'), value: ReportReason.Sexual },
                { label: t('report.violence'), value: ReportReason.Violence },
                { label: t('report.hate_speech'), value: ReportReason.HateSpeech },
                { label: t('report.self_harm'), value: ReportReason.SelfHarm },
                { label: t('report.terrorism'), value: ReportReason.Terrorism },
                { label: t('report.spam'), value: ReportReason.Spam },
                { label: t('report.violation'), value: ReportReason.Violation },
                { label: t('report.other'), value: ReportReason.Other }
              ]}
            />
          </n-space>
        </div>
      ),
      positiveText: t('report.submit'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        if (!selectedReason.value) {
          window.$message.warning(t('report.select_reason'))
          return false
        }
        try {
          isReporting.value = true
          await reportService.reportUser(userId, selectedReason.value)
          window.$message.success(t('report.success'))
          return true
        } catch (error) {
          console.error('[useReportDialog] report failed:', error)
          window.$message.error(t('report.failed'))
          return false
        } finally {
          isReporting.value = false
        }
      }
    })
    return result
  }

  async function reportMessage(eventId: string, roomId: string, reason?: ReportReason) {
    const selectedReason = ref(reason)
    const result = await dialog.warning({
      title: t('report.title'),
      content: () => <div>{t('report.select_reason')}</div>,
      action: () => (
        <div class="p-16px">
          <n-space vertical>
            <n-select
              v-model:value={selectedReason.value}
              placeholder={t('report.placeholder')}
              options={[
                { label: t('report.sexual'), value: ReportReason.Sexual },
                { label: t('report.violence'), value: ReportReason.Violence },
                { label: t('report.hate_speech'), value: ReportReason.HateSpeech },
                { label: t('report.self_harm'), value: ReportReason.SelfHarm },
                { label: t('report.terrorism'), value: ReportReason.Terrorism },
                { label: t('report.spam'), value: ReportReason.Spam },
                { label: t('report.violation'), value: ReportReason.Violation },
                { label: t('report.other'), value: ReportReason.Other }
              ]}
            />
          </n-space>
        </div>
      ),
      positiveText: t('report.submit'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        if (!selectedReason.value) {
          window.$message.warning(t('report.select_reason'))
          return false
        }
        try {
          isReporting.value = true
          const request: ReportRequest = {
            eventId,
            roomId,
            reason: selectedReason.value,
            explanation: ''
          }
          await reportService.reportEvent(request)
          window.$message.success(t('report.success'))
          return true
        } catch (error) {
          console.error('[useReportDialog] report failed:', error)
          window.$message.error(t('report.failed'))
          return false
        } finally {
          isReporting.value = false
        }
      }
    })
    return result
  }

  return {
    isReporting,
    reportUser,
    reportMessage,
    showReportDialog: reportMessage
  }
}
