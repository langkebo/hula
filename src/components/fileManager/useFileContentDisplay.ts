import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileBody } from '@/services/types'

export type FileItem = {
  id: string
  fileName?: string
  name?: string
  originalName?: string
  title?: string
  fileType?: string
  fileSize?: number
  downloadUrl?: string
  url?: string
  uploadTime: string
  sender?: {
    id: string
    name?: string
  }
}

export type TimeGroup = {
  date: string
  files: FileItem[]
}

export type User = {
  id: string
  name: string
}

// 检查文件是否匹配搜索关键词
export const matchesFileByKeyword = (file: FileItem, keyword: string) => {
  if (!keyword) {
    return true
  }

  const candidates = [
    file.fileName,
    file.name,
    file.originalName,
    file.title,
    file.sender?.name,
    file.fileType,
    file.downloadUrl,
    file.url
  ]

  return candidates.some((candidate) => {
    if (candidate == null) {
      return false
    }
    return String(candidate).toLowerCase().includes(keyword)
  })
}

type FileContentDisplayOptions = {
  activeNavigation: Ref<string>
  selectedUser: Ref<string>
  userList: Ref<User[]>
  fileSearchKeyword: Ref<string>
  hasActiveSearch: Ref<boolean>
  totalDisplayedFiles: Ref<number>
}

export const useFileContentDisplay = (options: FileContentDisplayOptions) => {
  const { activeNavigation, selectedUser, userList, fileSearchKeyword, hasActiveSearch, totalDisplayedFiles } = options
  const { t, locale } = useI18n()

  // 格式化时间分组标题：后端只返回机器可读日期，展示文案在前端按语言格式化
  const formatGroupDate = (date: string) => {
    if (!date || date === 'unknown') {
      return t('fileManager.time.unknown')
    }

    const parsed = new Date(`${date}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      return date
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((today.getTime() - parsed.getTime()) / 86_400_000)
    if (diffDays === 0) {
      return t('fileManager.time.today')
    }
    if (diffDays === 1) {
      return t('fileManager.time.yesterday')
    }

    const sameYear = parsed.getFullYear() === today.getFullYear()
    return new Intl.DateTimeFormat(locale.value, {
      ...(sameYear ? {} : { year: 'numeric' }),
      month: 'long',
      day: 'numeric'
    }).format(parsed)
  }

  // 获取文件搜索占位符
  const getFileSearchPlaceholder = () => {
    switch (activeNavigation.value) {
      case 'myFiles':
        return t('fileManager.search.placeholder.myFiles')
      case 'senders':
        return t('fileManager.search.placeholder.senders')
      case 'sessions':
        return t('fileManager.search.placeholder.sessions')
      case 'groups':
        return t('fileManager.search.placeholder.groups')
      default:
        return t('fileManager.search.placeholder.default')
    }
  }

  // 获取内容标题
  const getContentTitle = () => {
    const navigationTitles: { [key: string]: string } = {
      myFiles: t('fileManager.header.titles.myFiles'),
      senders: t('fileManager.header.titles.senders'),
      sessions: t('fileManager.header.titles.sessions'),
      groups: t('fileManager.header.titles.groups')
    }

    return navigationTitles[activeNavigation.value] || t('fileManager.header.titles.default')
  }

  // 获取内容副标题
  const getContentSubtitle = () => {
    const totalFiles = totalDisplayedFiles.value

    if (selectedUser.value) {
      const user = userList.value.find((u: User) => u.id === selectedUser.value)
      if (user) {
        return t('fileManager.header.subtitle.userFiles', { name: user.name, total: totalFiles })
      }
    }

    const keyword = fileSearchKeyword.value.trim()
    if (keyword) {
      return t('fileManager.header.subtitle.search', { total: totalFiles })
    }

    return t('fileManager.header.subtitle.total', { total: totalFiles })
  }

  const getEmptyStateIcon = () => {
    if (hasActiveSearch.value) {
      return 'search'
    }

    const navigationIcons: { [key: string]: string } = {
      myFiles: 'folder',
      senders: 'user',
      sessions: 'message',
      groups: 'group'
    }

    return navigationIcons[activeNavigation.value] || 'folder'
  }

  const getEmptyStateTitle = () => {
    if (hasActiveSearch.value) {
      return t('fileManager.empty.search')
    }

    if (selectedUser.value) {
      const user = userList.value.find((u: User) => u.id === selectedUser.value)
      return user ? t('fileManager.empty.userHasNoFiles', { name: user.name }) : t('fileManager.empty.default')
    }

    const navigationTitles: { [key: string]: string } = {
      myFiles: t('fileManager.empty.default'),
      senders: t('fileManager.empty.senders'),
      sessions: t('fileManager.empty.sessions'),
      groups: t('fileManager.empty.groups')
    }

    return navigationTitles[activeNavigation.value] || t('fileManager.empty.default')
  }

  // 转换文件数据为 FileBody 格式
  const convertToFileBody = (file: FileItem): FileBody => {
    return {
      fileName: file.fileName || '',
      size: file.fileSize || 0,
      url: file.url || file.downloadUrl || ''
    }
  }

  return {
    formatGroupDate,
    getFileSearchPlaceholder,
    getContentTitle,
    getContentSubtitle,
    getEmptyStateIcon,
    getEmptyStateTitle,
    convertToFileBody
  }
}
