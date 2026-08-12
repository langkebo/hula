import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import enChat from '~/locales/en/chat.json'
import enHome from '~/locales/en/home.json'
import zhCNChat from '~/locales/zh-CN/chat.json'
import zhCNHome from '~/locales/zh-CN/home.json'

/**
 * i18n 回归测试 — 防止此前发现的 key 路径不匹配问题复发。
 *
 * 历史问题（已修复）：
 *  1. ChatHeaderToolbar.vue 使用 t('chat.header.video_call')，但 i18n 定义在 chat_header.toolbar.video_call
 *  2. ChatHeaderInfo.vue 使用 t('home.chat_header.member_count')，但 key 不存在
 *  3. EncryptionStatus.vue 使用圆点而非锁图标（非 i18n，此处不覆盖）
 *  4. FooterToolbar.vue 使用不存在的 #timer SVG sprite（非 i18n，此处不覆盖）
 *
 * 本文件覆盖问题 1、2 的 i18n 维度，并做通用 key 存在性 / 非空 / 路径一致性校验。
 */

const __dirname = dirname(fileURLToPath(import.meta.url))

const CHAT_HEADER_TOOLBAR_PATH = resolve(__dirname, '../chatBox/ChatHeader/ChatHeaderToolbar.vue')
const CHAT_HEADER_INFO_PATH = resolve(__dirname, '../chatBox/ChatHeader/ChatHeaderInfo.vue')

type LocaleData = Record<string, unknown>

/**
 * 按点分路径在对象中解析值，找不到返回 undefined。
 */
function resolveKey(obj: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as LocaleData)) {
      return (acc as LocaleData)[segment]
    }
    return undefined
  }, obj)
}

/**
 * 从 Vue 组件源码中正则提取所有 t('...') 调用的 key。
 * 支持 t('key') / t("key") / t('key', {...}) 三种形式。
 * 可选 namespace 过滤：仅返回以指定前缀开头的 key。
 */
function extractI18nKeys(sourcePath: string, namespace?: string): string[] {
  const source = readFileSync(sourcePath, 'utf-8')
  const regex = /\bt\(\s*['"]([^'"]+)['"]/g
  const keys = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(source)) !== null) {
    const key = match[1]
    if (!namespace || key.startsWith(`${namespace}.`)) {
      keys.add(key)
    }
  }
  return [...keys].sort()
}

/**
 * 去掉 i18n key 的首个命名空间段（对应 JSON 文件名）。
 * 例：stripNamespace('chat.header.video_call', 'chat') => 'header.video_call'
 */
function stripNamespace(fullKey: string, namespace: string): string {
  const prefix = `${namespace}.`
  return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey
}

describe('i18n 回归测试 — 防止 key 路径不匹配复发', () => {
  describe('a. ChatHeaderToolbar — chat.header.* key 存在性', () => {
    const keys = extractI18nKeys(CHAT_HEADER_TOOLBAR_PATH, 'chat.header')

    it('从组件源码提取到 chat.header.* key（至少 8 个）', () => {
      expect(keys.length).toBeGreaterThanOrEqual(8)
    })

    // 验证此前出问题的 key 确实被组件使用
    it('组件使用了此前出问题的 chat.header.video_call key', () => {
      expect(keys).toContain('chat.header.video_call')
    })

    for (const key of keys) {
      const relPath = stripNamespace(key, 'chat')

      it(`zh-CN: ${key} 存在且为非空字符串`, () => {
        const value = resolveKey(zhCNChat, relPath)
        expect(value, `key "${key}" 在 zh-CN/chat.json 中不存在（路径: ${relPath}）`).toBeDefined()
        expect(typeof value, `key "${key}" 在 zh-CN/chat.json 中不是字符串`).toBe('string')
        expect(value, `key "${key}" 在 zh-CN/chat.json 中为空字符串`).not.toBe('')
        expect(value, `key "${key}" 在 zh-CN/chat.json 中值等于 key 本身（未翻译）`).not.toBe(key)
      })

      it(`en: ${key} 存在且为非空字符串`, () => {
        const value = resolveKey(enChat, relPath)
        expect(value, `key "${key}" 在 en/chat.json 中不存在（路径: ${relPath}）`).toBeDefined()
        expect(typeof value, `key "${key}" 在 en/chat.json 中不是字符串`).toBe('string')
        expect(value, `key "${key}" 在 en/chat.json 中为空字符串`).not.toBe('')
        expect(value, `key "${key}" 在 en/chat.json 中值等于 key 本身（未翻译）`).not.toBe(key)
      })
    }
  })

  describe('b. ChatHeaderInfo — home.chat_header.member_count 存在性', () => {
    it('zh-CN: home.chat_header.member_count 存在且为非空字符串', () => {
      const value = resolveKey(zhCNHome, 'chat_header.member_count')
      expect(value, 'home.chat_header.member_count 在 zh-CN/home.json 中不存在').toBeDefined()
      expect(typeof value).toBe('string')
      expect(value).not.toBe('')
      expect(value).not.toBe('home.chat_header.member_count')
    })

    it('en: home.chat_header.member_count 存在且为非空字符串', () => {
      const value = resolveKey(enHome, 'chat_header.member_count')
      expect(value, 'home.chat_header.member_count 在 en/home.json 中不存在').toBeDefined()
      expect(typeof value).toBe('string')
      expect(value).not.toBe('')
      expect(value).not.toBe('home.chat_header.member_count')
    })

    // 关联 key：ChatHeaderInfo 还使用 federated / federated_tooltip，一并守护
    it('zh-CN: home.chat_header.federated 与 federated_tooltip 存在', () => {
      expect(resolveKey(zhCNHome, 'chat_header.federated')).toBeDefined()
      expect(resolveKey(zhCNHome, 'chat_header.federated_tooltip')).toBeDefined()
    })

    it('en: home.chat_header.federated 与 federated_tooltip 存在', () => {
      expect(resolveKey(enHome, 'chat_header.federated')).toBeDefined()
      expect(resolveKey(enHome, 'chat_header.federated_tooltip')).toBeDefined()
    })
  })

  describe('c. 关键 i18n key 翻译值非空、非原始 key 字符串', () => {
    const cases: Array<{
      key: string
      namespace: string
      locale: string
      data: LocaleData
    }> = [
      // chat.header.* — ChatHeaderToolbar 核心按钮
      { key: 'chat.header.video_call', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.header.voice_call', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.header.start_meeting', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.header.screen_share', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.header.more_options', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.header.search_messages', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.header.group_qr_code', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      // chat.footer.* — 底部工具栏
      { key: 'chat.footer.emoji', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.footer.send_file', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      { key: 'chat.footer.send_image', namespace: 'chat', locale: 'zh-CN', data: zhCNChat },
      // home.chat_header.* — ChatHeaderInfo
      { key: 'home.chat_header.member_count', namespace: 'home', locale: 'zh-CN', data: zhCNHome },
      { key: 'home.chat_header.federated', namespace: 'home', locale: 'zh-CN', data: zhCNHome },
      // en 对应项
      { key: 'chat.header.video_call', namespace: 'chat', locale: 'en', data: enChat },
      { key: 'chat.header.voice_call', namespace: 'chat', locale: 'en', data: enChat },
      { key: 'chat.header.more_options', namespace: 'chat', locale: 'en', data: enChat },
      { key: 'home.chat_header.member_count', namespace: 'home', locale: 'en', data: enHome }
    ]

    for (const { key, namespace, locale, data } of cases) {
      it(`[${locale}] ${key} 翻译值非空且非原始 key`, () => {
        const relPath = stripNamespace(key, namespace)
        const value = resolveKey(data, relPath)
        expect(value, `key "${key}" 在 ${locale} 中不存在`).toBeDefined()
        expect(typeof value, `key "${key}" 在 ${locale} 中不是字符串`).toBe('string')
        expect(value, `key "${key}" 在 ${locale} 中为空`).not.toBe('')
        expect(value, `key "${key}" 在 ${locale} 中值等于 key 本身`).not.toBe(key)
      })
    }
  })

  describe('d. i18n key 路径一致性验证', () => {
    // 历史问题：组件用 chat.header.video_call，但 locale 定义在 chat_header.toolbar.video_call
    // 修复后：chat.json 的 header.video_call 路径与组件 t('chat.header.video_call') 一致

    it('chat.header.* 路径在 chat.json 中为 header.*（非 chat_header.toolbar.*）', () => {
      // chat.json 的顶层有 header 对象
      expect(resolveKey(zhCNChat, 'header')).toBeDefined()
      expect(typeof resolveKey(zhCNChat, 'header')).toBe('object')
      // chat.json 的 header 下有 video_call
      expect(resolveKey(zhCNChat, 'header.video_call')).toBe('视频通话')
      expect(resolveKey(enChat, 'header.video_call')).toBe('Video Call')
    })

    it('home.chat_header.toolbar.* 是 home.json 中独立的路径（与 chat.header.* 分属不同文件）', () => {
      // home.json 的 chat_header.toolbar 下也有 video_call，但这是不同命名空间
      // 两者翻译值可能相同（如均为"视频通话"），关键在于分属不同文件、不同路径，不会互相覆盖
      expect(resolveKey(zhCNHome, 'chat_header.toolbar.video_call')).toBeDefined()
      expect(resolveKey(enHome, 'chat_header.toolbar.video_call')).toBeDefined()
      // chat.header.video_call 解析自 chat.json，home.chat_header.toolbar.video_call 解析自 home.json
      expect(resolveKey(zhCNChat, 'header.video_call')).toBeDefined()
      expect(resolveKey(zhCNHome, 'header.video_call')).toBeUndefined()
      expect(resolveKey(zhCNChat, 'chat_header.toolbar.video_call')).toBeUndefined()
    })

    it('ChatHeaderToolbar 所有 chat.header.* key 的路径段与 chat.json 结构一致', () => {
      const keys = extractI18nKeys(CHAT_HEADER_TOOLBAR_PATH, 'chat.header')
      const missing: string[] = []
      for (const key of keys) {
        const relPath = stripNamespace(key, 'chat')
        const value = resolveKey(zhCNChat, relPath)
        if (typeof value !== 'string' || value === '') {
          missing.push(key)
        }
      }
      expect(missing, `以下 key 路径在 chat.json 中不一致: ${missing.join(', ')}`).toEqual([])
    })

    it('ChatHeaderInfo 的 home.chat_header.member_count 路径段与 home.json 结构一致', () => {
      const value = resolveKey(zhCNHome, 'chat_header.member_count')
      expect(typeof value).toBe('string')
      expect(value).toContain('{count}')
    })

    it('ChatHeaderInfo 使用的 home.chat_header.* key 路径段与 home.json 结构一致', () => {
      // 提取 ChatHeaderInfo 中所有 home.chat_header.* key 并验证路径一致性
      const keys = extractI18nKeys(CHAT_HEADER_INFO_PATH, 'home.chat_header')
      const missing: string[] = []
      for (const key of keys) {
        const relPath = stripNamespace(key, 'home')
        const value = resolveKey(zhCNHome, relPath)
        if (typeof value !== 'string' && typeof value !== 'object') {
          missing.push(key)
        }
      }
      expect(missing, `以下 key 路径在 home.json 中不一致: ${missing.join(', ')}`).toEqual([])
    })
  })
})
