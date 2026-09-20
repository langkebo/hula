import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 设备验证流程「接线与文案」源码契约测试
 *
 * 覆盖：
 * 1. 设备验证对话框全部 `t('setting.*')` 字面量键必须能在 zh-CN / en 语言包解析
 *    （key 一旦写错路径，运行期只会渲染出原始 key，且组件测试用自己的 t stub
 *    永远发现不了 —— 本文件直接读真实语言包，堵住这个盲区）
 * 2. 禁止重新引入已知错误前缀 `setting.device_verify_dialog.`
 * 3. zh-CN 与 en 的 device_verify_dialog 键集合必须一致
 * 4. DeviceTrustManager 跨用户验证必须传 userId
 * 5. renderMessage 锁徽章 → 验证对话框的接线（interactive / verify / 目标用户）
 * 6. ChatMain 是验证对话框的单例挂载点
 *
 * 不覆盖：验证流程的运行期状态机（见 DeviceVerifyDialog.*.test.ts）
 */

const ROOT = resolve(__dirname, '../../../..')

const read = (relativePath: string) => readFileSync(resolve(ROOT, relativePath), 'utf-8')
const readJson = (relativePath: string) => JSON.parse(read(relativePath)) as Record<string, unknown>

const ENCRYPTION_COMPONENT_DIR = 'src/components/encryption'

/**
 * 按 `locales/{lang}/{ns}.json` 约定解析完整键。
 *
 * 约定：**文件名即顶层命名空间**，因此 `setting.encryption.title` 对应
 * `locales/{lang}/setting.json` 中的 `{ encryption: { title } }` —— 首段要剥掉。
 * 语言包缓存避免逐键重复读盘。
 */
const messageCache = new Map<string, Record<string, unknown>>()
function resolveFullKey(locale: 'zh-CN' | 'en', fullKey: string): unknown {
  const [namespace, ...rest] = fullKey.split('.')
  if (!namespace || rest.length === 0) return undefined

  const cacheKey = `${locale}/${namespace}`
  if (!messageCache.has(cacheKey)) {
    try {
      messageCache.set(cacheKey, readJson(`locales/${locale}/${namespace}.json`))
    } catch {
      messageCache.set(cacheKey, {})
    }
  }

  return rest.reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null) return undefined
    return (current as Record<string, unknown>)[segment]
  }, messageCache.get(cacheKey))
}

/** 设备验证流程涉及的生产代码文件（组件目录全量 + 组合式函数 + 两个调用方） */
function deviceVerifyFlowSources(): Array<{ path: string; code: string }> {
  const componentFiles = readdirSync(resolve(ROOT, ENCRYPTION_COMPONENT_DIR))
    .filter((name) => name.endsWith('.vue'))
    .map((name) => `${ENCRYPTION_COMPONENT_DIR}/${name}`)

  return [
    ...componentFiles,
    'src/composables/encryption/useDeviceVerifyDialog.ts',
    'src/views/settingsWindow/tabs/EncryptionSettings.vue'
  ].map((path) => ({ path, code: read(path) }))
}

/** 提取源码中 `t('literal')` / `t("literal")` 的键（仅带点号的完整路径） */
function extractTranslationKeys(code: string): string[] {
  const keys = new Set<string>()
  for (const match of code.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.-]+)['"]/g)) {
    if (match[1].includes('.')) keys.add(match[1])
  }
  return [...keys]
}

describe('设备验证流程接线与文案契约', () => {
  describe('i18n 键可达性', () => {
    const sources = deviceVerifyFlowSources()

    it('扫描范围覆盖到设备验证各步骤组件与组合式函数', () => {
      const paths = sources.map((source) => source.path)
      expect(paths).toContain(`${ENCRYPTION_COMPONENT_DIR}/DeviceVerifyDialog.vue`)
      expect(paths).toContain(`${ENCRYPTION_COMPONENT_DIR}/DeviceVerifyIntroStep.vue`)
      expect(paths).toContain('src/composables/encryption/useDeviceVerifyDialog.ts')
    })

    it('每个 t() 键都能在 zh-CN 与 en 语言包中解析', () => {
      const unresolved: string[] = []

      for (const { path, code } of sources) {
        for (const key of extractTranslationKeys(code)) {
          if (!key.startsWith('setting.')) continue
          if (typeof resolveFullKey('zh-CN', key) !== 'string') unresolved.push(`${key}  [zh-CN ${path}]`)
          if (typeof resolveFullKey('en', key) !== 'string') unresolved.push(`${key}  [en ${path}]`)
        }
      }

      expect(unresolved).toEqual([])
    })

    it('源码中不得再出现已知的错误前缀 setting.device_verify_dialog.', () => {
      // 真实键路径是 setting.encryption.device_verify_dialog.*（嵌套在 encryption 下）。
      // 写成 setting.device_verify_dialog.* 会让该子树的全部文案退化成原始 key。
      const offenders: string[] = []

      for (const { path, code } of sources) {
        if (code.includes('setting.device_verify_dialog.')) offenders.push(path)
      }

      expect(offenders).toEqual([])
    })

    it('zh-CN 与 en 的 device_verify_dialog 键集合一致', () => {
      const zh = resolveFullKey('zh-CN', 'setting.encryption.device_verify_dialog') as Record<string, unknown>
      const en = resolveFullKey('en', 'setting.encryption.device_verify_dialog') as Record<string, unknown>

      expect(zh).toBeTypeOf('object')
      expect(en).toBeTypeOf('object')
      expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    })

    it('跨用户验证所需的文案键齐备', () => {
      const zh = resolveFullKey('zh-CN', 'setting.encryption.device_verify_dialog') as Record<string, unknown>

      for (const key of [
        'verify_user_label',
        'select_device_label',
        'select_device_placeholder',
        'select_device_required',
        'no_device_available'
      ]) {
        expect(zh[key], `缺少键 ${key}`).toBeTypeOf('string')
      }
    })
  })

  describe('DeviceTrustManager 跨用户验证', () => {
    const source = read(`${ENCRYPTION_COMPONENT_DIR}/DeviceTrustManager.vue`)

    it('验证对话框上必须绑定 user-id', () => {
      // 「未验证设备」/「已屏蔽设备」两个 tab 的条目可能属于其他用户；
      // 不传 userId 会让对话框把 targetUserId 解析成自己，发出 (自己, 对方设备) 的无效事务
      expect(source).toMatch(/<DeviceVerifyDialog[\s\S]*?:user-id="verifyTargetUserId"/)
    })

    it('handleVerifyDevice 必须把 device.userId 写入目标用户', () => {
      expect(source).toMatch(/verifyTargetUserId\.value\s*=\s*device\.userId/)
    })
  })

  describe('renderMessage 锁徽章接线', () => {
    const source = read('src/components/rightBox/renderMessage/index.vue')

    it('徽章通过 interactive 开启交互态并监听 verify', () => {
      expect(source).toMatch(/:interactive="canVerifySender"/)
      expect(source).toMatch(/@verify="handleVerifySender"/)
    })

    it('canVerifySender 必须同时要求「已加密 + 非自己 + 有发送者」', () => {
      const match = source.match(/const canVerifySender = computed\(\(\) =>([^\n]*)\)/)
      expect(match).toBeTruthy()
      const expression = match?.[1] ?? ''
      expect(expression).toContain('isEncryptedMessage')
      expect(expression).toContain('!isMe')
      expect(expression).toContain('senderUid')
    })

    it('点击后以发送者为目标用户打开对话框', () => {
      expect(source).toMatch(/openDeviceVerification\(\{\s*userId:\s*senderUid\.value\s*\}\)/)
    })

    it('使用的是单例启动器而非本地 state', () => {
      expect(source).toMatch(
        /import\s*\{[^}]*\buseDeviceVerifyLauncher\b[^}]*\}\s*from\s*'@\/composables\/encryption\/useDeviceVerifyLauncher'/
      )
    })
  })

  describe('ChatMain 单例挂载点', () => {
    const source = read('src/components/rightBox/chatBox/ChatMain.vue')

    it('挂载一份 DeviceVerifyDialog 并绑定启动器状态', () => {
      expect(source).toMatch(/<DeviceVerifyDialog[\s\S]*?:show="deviceVerifyVisible"/)
      expect(source).toMatch(/:user-id="deviceVerifyTarget\.userId"/)
    })

    it('对话框自行关闭时同步清空启动器状态', () => {
      expect(source).toMatch(
        /function handleDeviceVerifyShowChange\(value: boolean\)\s*\{\s*if \(!value\) closeDeviceVerify\(\)/
      )
    })
  })
})
