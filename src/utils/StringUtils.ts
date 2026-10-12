/**
 * 给一个不是'/'开头的字符串的头部添加一个'/'
 * @param originPath
 */
export const addSlashToHead = (originPath: string) => {
  return originPath.startsWith('/') ? originPath : '/' + originPath
}

/**
 * 保留头尾、以省略号截断中间部分的字符串
 * 统一 event id / session id / room id 等长标识的展示截断。
 * @param value 原始字符串
 * @param maxLength 超过该长度才截断
 * @param keepHead 保留的头部字符数
 * @param keepTail 保留的尾部字符数
 */
export const truncateMiddle = (value: string, maxLength = 24, keepHead = 12, keepTail = 8): string => {
  if (value.length <= maxLength) return value
  return `${value.slice(0, keepHead)}...${value.slice(-keepTail)}`
}

/**
 * 判断字符串是否为合法 URL（可被 new URL 解析）
 * @param value 待校验字符串
 */
export const isValidUrl = (value: string): boolean => {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}
