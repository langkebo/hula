import { createDiscreteApi } from 'naive-ui'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixEventService } from '@/services/matrix/MatrixEventService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useReportDialog')
const { dialog, message } = createDiscreteApi(['dialog', 'message'])

export interface ReportOptions {
  roomId: string
  eventId: string
  senderId?: string
}

export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'violence' | 'other'

const reportReasons: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: '垃圾信息' },
  { value: 'inappropriate', label: '不当内容' },
  { value: 'harassment', label: '骚扰' },
  { value: 'violence', label: '暴力' },
  { value: 'other', label: '其他' }
]

export function useReportDialog() {
  const showReportDialog = (options: ReportOptions) => {
    dialog.create({
      title: '举报消息',
      content: '请确认举报此消息？举报原因将用于审核处理。',
      positiveText: '确认举报',
      negativeText: '取消',
      onPositiveClick: async () => {
        await submitReport(options)
      }
    })
  }

  const submitReport = async (options: ReportOptions) => {
    try {
      logger.debug('提交举报:', options)

      if (!matrixClientService.isConnected()) {
        message.error('客户端未连接')
        return
      }

      await matrixEventService.redactEvent(options.roomId, options.eventId, '用户举报')

      message.success('举报成功，我们会尽快处理')
      logger.info('举报提交成功:', options.eventId)
    } catch (error) {
      logger.error('举报提交失败:', error)
      message.error('举报失败，请稍后重试')
    }
  }

  return {
    showReportDialog,
    submitReport,
    reportReasons
  }
}
