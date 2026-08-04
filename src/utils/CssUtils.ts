/**
 * CSS 相关的实用工具函数
 */

/**
 * 获取指定的 CSS 变量值
 * @param name 变量名，例如 '--tjg-color-primary-500'
 * @returns 变量值字符串
 */
const getCssVar = (name: string): string => {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * 兼容性别名，部分旧代码可能在使用 cssVar 这个名字
 */
export const cssVar = getCssVar
