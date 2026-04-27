const MOBILE_PLATFORMS = new Set(['android', 'ios'])

/** 标准化平台标识，确保比较逻辑一致 */
const normalizePlatform = (platform?: string) => {
  return platform?.trim().toLowerCase()
}

/** 判断是否为需要加载移动端组件的平台 */
export const isMobilePlatform = (platform?: string) => {
  return MOBILE_PLATFORMS.has(normalizePlatform(platform) ?? '')
}

/** 根据平台返回自动导入插件需要扫描的组件目录 */
export const getComponentsDirs = (platform?: string) => {
  const normalizedPlatform = normalizePlatform(platform)
  if (!normalizedPlatform || isMobilePlatform(normalizedPlatform)) {
    return ['src/components', 'src/mobile/components']
  }
  return ['src/components']
}

/** 使用 globs 精确控制自动注册范围，避免显式导入的同名组件发生冲突 */
export const getComponentsGlobs = (platform?: string) => {
  const normalizedPlatform = normalizePlatform(platform)
  const globs = ['src/components/**/*.vue']

  if (!normalizedPlatform || isMobilePlatform(normalizedPlatform)) {
    globs.push('src/mobile/components/**/*.vue')
  }

  globs.push(
    '!src/components/thread/ThreadIndicator.vue',
    '!src/components/thread/ThreadView.vue',
    '!src/mobile/components/thread/ThreadIndicator.vue',
    '!src/mobile/components/thread/ThreadView.vue'
  )

  return globs
}

/** 按平台选择对应的组件类型声明文件路径 */
export const getComponentsDtsPath = (platform?: string) => {
  const normalizedPlatform = normalizePlatform(platform)
  if (!normalizedPlatform) {
    return 'src/typings/components.d.ts'
  }
  return isMobilePlatform(normalizedPlatform) ? 'src/typings/components.mobile.d.ts' : 'src/typings/components.pc.d.ts'
}
