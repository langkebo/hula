import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * presence 唯一写入点结构守卫。
 *
 * 背景：门控规则原本只有一份实现（resolveOutgoingPresence），但「是否走门控」由各调用点
 * 自觉决定，于是存在两条绕过门控的裸 SDK 写入路径，移动端切状态正是从其中一条泄漏的。
 * 现在门控与记账都在 `MatrixPresenceService.setPresence` 内完成，因此**任何**直接调用
 * SDK presence 写入（`presenceManager.setPresence` / `client.setPresence`）的新代码都会
 * 重新打开这个缺口。本守卫把该不变量从「文档约定」变成「可执行检查」：
 * 除唯一写入点自身外，源码里不允许出现裸的 `.setPresence(`。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../../..')
const SRC_ROOT = join(REPO_ROOT, 'src')
const SINGLE_WRITER = join(SRC_ROOT, 'services/matrix/user/MatrixPresenceService.ts')

/** 允许的门控调用：`matrixPresenceService.setPresence(...)`（含换行写法） */
const GATED_CALL = /\bmatrixPresenceService\s*\.\s*setPresence/g
/** 任何其它对象的 setPresence 调用都视为裸写 */
const RAW_PRESENCE_WRITE = /\.setPresence\s*\(/

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'typings') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc)
    } else if ((entry.endsWith('.ts') || entry.endsWith('.vue')) && !entry.endsWith('.d.ts')) {
      acc.push(full)
    }
  }
  return acc
}

describe('presence 唯一写入点', () => {
  it('除 MatrixPresenceService 外没有任何源码直接调用 SDK 的 setPresence', () => {
    const files = collectSourceFiles(SRC_ROOT)
    const offenders: string[] = []

    for (const file of files) {
      if (file === SINGLE_WRITER) continue
      const src = readFileSync(file, 'utf8').replace(GATED_CALL, 'GATED_CALL')
      for (const line of src.split('\n')) {
        if (RAW_PRESENCE_WRITE.test(line)) {
          offenders.push(`${relative(REPO_ROOT, file)}: ${line.trim()}`)
        }
      }
    }

    // 防止「扫描目录为空所以永远通过」的假绿
    expect(files.length).toBeGreaterThan(100)
    expect(offenders).toEqual([])
  })

  it('唯一写入点自身确实执行 SDK 写入，且门控规则在其中生效', () => {
    const src = readFileSync(SINGLE_WRITER, 'utf8')

    expect(src).toMatch(/presenceManager\.setPresence\s*\(/)
    expect(src).toMatch(/resolveOutgoingPresence\s*\(/)
    expect(src).toMatch(/recordSentPresence\s*\(/)
  })
})
