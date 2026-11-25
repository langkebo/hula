import { describe, expect, it } from 'vitest'
import { createCodeSplittingGroups } from '~/build/config/chunks'

/** 按 rolldown 语义复算模块归属：priority 高者先匹配，同优先级按声明顺序 */
const createResolver = () => {
  const groups = createCodeSplittingGroups()
  return (moduleId: string): string | undefined => {
    for (const group of groups) {
      if (!group.test(moduleId)) {
        continue
      }
      return typeof group.name === 'string' ? group.name : (group.name(moduleId) ?? undefined)
    }
    return undefined
  }
}

describe('createCodeSplittingGroups', () => {
  const resolveChunk = createResolver()

  it('分组按 priority 降序声明，保证先声明的规则优先命中', () => {
    const priorities = createCodeSplittingGroups().map((group) => group.priority)
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a))
  })

  it('link 版 matrix-js-sdk 源码路径归入 matrix-sdk chunk', () => {
    expect(resolveChunk('/Users/ci/work/matrix-js-sdk/src/client.ts')).toBe('matrix-sdk')
    expect(resolveChunk('/Users/ci/work/matrix-js-sdk/src/http-api/index.ts')).toBe('matrix-sdk')
  })

  it('npm 安装形态仍然命中', () => {
    expect(resolveChunk('/repo/node_modules/matrix-js-sdk/lib/index.js')).toBe('matrix-sdk')
  })

  it('本项目 src 路径不受影响', () => {
    expect(resolveChunk('/Users/ci/work/hula/src/services/matrix/MatrixClientService.ts')).toBeUndefined()
  })

  it('capture 依赖的基础模块不会被 chat-domain 吞掉', () => {
    expect(resolveChunk('/repo/src/enums/app.ts')).toBe('enums')
    expect(resolveChunk('/repo/src/stores/domains/settings/settings-helpers.ts')).toBe('theme')
    expect(resolveChunk('/repo/src/stores/domains/settings/settingThemeActions.ts')).toBe('theme')
    expect(resolveChunk('/repo/src/utils/Logger.ts')).toBe('logger')
    expect(resolveChunk('/repo/src/services/i18n.ts')).toBe('i18n')
  })

  it('i18n 语言包与入口服务同 chunk，避免 capture 预加载上百个文件', () => {
    expect(resolveChunk('/repo/locales/zh-CN/admin.json')).toBe('i18n')
    expect(resolveChunk('/repo/locales/en/chat.json')).toBe('i18n')
    // errors 子集规则声明更早，优先级更高
    expect(resolveChunk('/repo/src/locales/errors/zh-CN.ts')).toBe('app-errors')
  })

  it('@vue-office 按包名拆出独立 chunk', () => {
    expect(resolveChunk('/repo/node_modules/@vue-office/docx/lib/index.js')).toBe('vue-office-docx')
  })

  it('剩余 node_modules 兜底进 vendor', () => {
    expect(resolveChunk('/repo/node_modules/some-package/index.js')).toBe('vendor')
    expect(resolveChunk('/repo/src/components/rightBox/chatBox/index.vue')).toBe('chat-domain')
  })
})
