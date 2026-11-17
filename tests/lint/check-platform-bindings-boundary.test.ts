import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 平台入口守卫（§19.40 已知边界 2「双端入口文件」专项）。
 *
 * 背景：平台差异实现原先由 `src/platform/*` 注册表在运行期按 `isMobile()` 二选一，
 * 静态 import 会让桌面产物同时装进 `src/mobile/platform/**`。改为构建期入口后，
 * 桌面只引用 `src/platform/entries/*`，移动构建由 vite alias 整体替换。
 *
 * 每个差异实现各占一个入口（存储布局 / 启动 / 会话事件策略），不做聚合：聚合入口会
 * 把会话事件策略（依赖 useWindow）拉进只用存储布局的模块图，破坏原有模块边界。
 *
 * 本守卫锁住三件事：桌面侧不出现移动端 import、每个入口双端同符号同实现、alias 存在。
 */

const ROOT = process.cwd()
const PLATFORM_DIR = join(ROOT, 'src/platform')
const DESKTOP_ENTRIES = join(PLATFORM_DIR, 'entries')
const MOBILE_ENTRIES = join(ROOT, 'src/mobile/platform/entries')
const VITE_CONFIG = join(ROOT, 'vite.config.ts')

/** 双端入口文件名，新增平台差异实现时必须同步登记 */
const ENTRY_NAMES = ['storageLayout', 'platformBoot', 'sessionEventStrategy'] as const

const collectTsFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : collectTsFiles(full)
    }
    return entry.name.endsWith('.ts') ? [full] : []
  })

const importsOf = (content: string): string[] =>
  [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])

/** 入口导出的符号名（`export const platformXxx: T = impl`） */
const exportedName = (content: string): string => content.match(/export const (\w+)/)?.[1] ?? ''

/** 入口引用的实现模块（最后一条 import 必须是平台实现，contract 是类型 import） */
const implementationOf = (content: string): string =>
  importsOf(content)
    .filter((spec) => spec !== '@/platform/contracts')
    .join(',')

describe('platform entries', () => {
  it('桌面平台模块不得静态引用移动端实现', () => {
    const offenders = collectTsFiles(PLATFORM_DIR)
      .filter((file) => /from\s+['"]@\/mobile\//.test(readFileSync(file, 'utf-8')))
      .map((file) => file.replace(`${ROOT}/`, ''))

    expect(offenders, `桌面侧出现移动端 import（请走 @/platform/entries/*）：\n${offenders.join('\n')}`).toEqual([])
  })

  it('每个桌面入口只装配桌面实现', () => {
    const offenders = ENTRY_NAMES.filter((name) => {
      const imports = importsOf(readFileSync(join(DESKTOP_ENTRIES, `${name}.ts`), 'utf-8'))
      return !imports
        .filter((spec) => spec !== '@/platform/contracts')
        .every((spec) => spec.startsWith('@/platform/desktop/'))
    })

    expect(offenders, `以下桌面入口引用了非桌面实现：${offenders.join(', ')}`).toEqual([])
  })

  it('每个入口双端导出同符号、且各装配本端实现', () => {
    const mismatches = ENTRY_NAMES.flatMap((name) => {
      const desktop = readFileSync(join(DESKTOP_ENTRIES, `${name}.ts`), 'utf-8')
      const mobile = readFileSync(join(MOBILE_ENTRIES, `${name}.ts`), 'utf-8')
      const problems: string[] = []

      if (!exportedName(desktop) || exportedName(desktop) !== exportedName(mobile)) {
        problems.push(`${name}: 导出符号不一致（桌面=${exportedName(desktop) || '(缺失)'}）`)
      }
      if (!implementationOf(desktop).startsWith('@/platform/desktop/')) {
        problems.push(`${name}: 桌面入口未装配 @/platform/desktop/*`)
      }
      if (!implementationOf(mobile).startsWith('@/mobile/platform/')) {
        problems.push(`${name}: 移动入口未装配 @/mobile/platform/*`)
      }
      return problems
    })

    expect(mismatches, `双端入口漂移：\n${mismatches.join('\n')}`).toEqual([])
  })

  it('移动构建把每个入口 alias 到移动装配', () => {
    const content = readFileSync(VITE_CONFIG, 'utf-8')
    const missing = ENTRY_NAMES.filter(
      (name) =>
        !new RegExp(`find:\\s*'@/platform/entries/${name}'`).test(content) ||
        !content.includes(`src/mobile/platform/entries/${name}.ts`)
    )

    expect(missing, `vite.config.ts 缺少以下入口的移动 alias：${missing.join(', ')}`).toEqual([])
  })

  it('入口目录不得出现未登记的实现（防止新增差异偷偷走运行期分派）', () => {
    const registered = new Set(ENTRY_NAMES.map((name) => `${name}.ts`))
    const unknown = [DESKTOP_ENTRIES, MOBILE_ENTRIES].flatMap((dir) =>
      readdirSync(dir)
        .filter((file) => file.endsWith('.ts') && !registered.has(file))
        .map((file) => `${dir.replace(`${ROOT}/`, '')}/${file}`)
    )

    expect(unknown, `以下入口未登记到 ENTRY_NAMES：\n${unknown.join('\n')}`).toEqual([])
  })
})
