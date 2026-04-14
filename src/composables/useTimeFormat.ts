import { useI18n } from 'vue-i18n'
import { formatTimestamp, timeToStr } from '@/utils/ComputedTime'

export function useTimeFormat() {
  const { t } = useI18n()

  function formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) {
      return t('time.just_now', '刚刚')
    }
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return t('time.minutes_ago', '{n}分钟前').replace('{n}', String(minutes))
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return t('time.hours_ago', '{n}小时前').replace('{n}', String(hours))
    }
    if (diff < 172800000) {
      return t('time.yesterday', '昨天')
    }

    return formatTimestamp(timestamp)
  }

  function formatMessageTime(timestamp: number): string {
    return timeToStr(timestamp)
  }

  return {
    formatRelativeTime,
    formatMessageTime
  }
}
