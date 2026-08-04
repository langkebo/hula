import type { ConfigType, OpUnitType } from 'dayjs'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import weekday from 'dayjs/plugin/weekday'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import { useI18nGlobal } from '@/services/i18n'

export const setDayjsLocale = (lang: string) => {
  const mapped = lang.toLowerCase().includes('zh') ? 'zh-cn' : 'en'
  dayjs.locale(mapped)
}

dayjs.extend(relativeTime)
dayjs.extend(weekday)
setDayjsLocale('zh-CN')

/**
 * 统一消息时间格式化（合并 timeToStr + formatTimestamp + formatMessageTime）
 *
 * 规则（detail=false，默认）：
 * - 无效时间：空字符串
 * - 未来时间：YYYY-MM-DD HH:mm
 * - < 1 分钟：刚刚
 * - < 1 小时：X 分钟前
 * - 今天：HH:mm
 * - 昨天：昨天 HH:mm
 * - 跨年：YYYY-MM-DD
 * - 本周：星期几 HH:mm
 * - 更早：YYYY-MM-DD HH:mm
 *
 * 规则（detail=true）：
 * - 今天：HH:mm:ss
 * - 跨年：YYYY-MM-DD HH:mm:ss
 * - 同年非今天：MM-DD HH:mm:ss
 */
export const formatChatTime = (timestamp: number, opts?: { detail?: boolean }): string => {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return ''

  const now = dayjs()
  const date = dayjs(ts)
  const i18n = useI18nGlobal()

  // detail 模式：显示完整日期时间
  if (opts?.detail) {
    if (now.year() !== date.year()) {
      return date.format('YYYY-MM-DD HH:mm:ss')
    }
    if (now.isSame(date, 'day')) {
      return date.format('HH:mm:ss')
    }
    return date.format('MM-DD HH:mm:ss')
  }

  // 非 detail 模式：智能格式化
  const nowMs = Date.now()
  const diff = nowMs - ts

  // 容错：未来时间直接显示绝对时间
  if (diff < 0) {
    return date.format('YYYY-MM-DD HH:mm')
  }

  // < 1 分钟：刚刚
  if (diff < 60_000) {
    return i18n.t('common.just_now')
  }

  // < 1 小时：X 分钟前
  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000)
    return i18n.t('common.minutes_ago', { count: minutes })
  }

  // 今天：HH:mm
  if (now.isSame(date, 'day')) {
    return date.format('HH:mm')
  }

  // 昨天：昨天 HH:mm（必须在跨年检查之前，否则跨年昨天会显示为 YYYY-MM-DD）
  if (now.subtract(1, 'day').isSame(date, 'day')) {
    return `${i18n.t('menu.yesterday')} ${date.format('HH:mm')}`
  }

  // 跨年：YYYY-MM-DD
  if (now.year() !== date.year()) {
    return date.format('YYYY-MM-DD')
  }

  // 本周：星期几 HH:mm
  if (diff < 7 * 86_400_000) {
    return date.format('dddd HH:mm')
  }

  // 更早：YYYY-MM-DD HH:mm
  return date.format('YYYY-MM-DD HH:mm')
}

/**
 * 消息间隔判断
 * @param {ConfigType} time 输入时间
 * @param {OpUnitType} unit 间隔单位
 * @param {number} diff 间隔值
 * @returns boolean 输入时间是否间隔 now 间隔值以上。
 */
export const isDiffNow = ({ time, unit, diff }: { unit: OpUnitType; time: ConfigType; diff: number }): boolean => {
  return dayjs().diff(dayjs(time), unit) > diff
}

/**
 * 格式化日期分组标签（用于聊天历史等场景）
 * @param timestamp 时间戳
 * @returns 格式化后的日期字符串（今天/昨天/MM-DD）
 */
export const formatDateLabel = (timestamp: number): string => {
  const date = dayjs(timestamp)
  const now = dayjs()
  const i18n = useI18nGlobal()

  if (now.isSame(date, 'day')) {
    return i18n.t('menu.today')
  } else if (now.subtract(1, 'day').isSame(date, 'day')) {
    return i18n.t('menu.yesterday')
  } else {
    return date.format('MM-DD')
  }
}

/** 相对时间(前) */
export const handRelativeTime = (time: string) => {
  return dayjs(time).fromNow()
}

/** 获取指定日期的星期 */
export const getWeekday = (time: string) => {
  return dayjs(time).format('ddd')
}
