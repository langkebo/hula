/**
 * `scripts/sdk-lib-fingerprint.mjs` 的单元测试（N-05）。
 *
 * 这个指纹是 `verify:sdk-pin` 用来把「node_modules 里已安装的 SDK」与
 * 「vendor/*.tgz 的内容」绑起来的唯一依据（见方案文档 §9.14.9）。它一旦写错，
 * 后果是**两个方向都有害**：
 *
 *   · 判据过松（漏掉某种改动）⇒ 回到 N-05 的假绿：陈旧产物继续被当成合格；
 *   · 判据过紧（对无关差异敏感，例如遍历顺序）⇒ 门禁恒红，最后只会被关掉。
 *
 * 所以这里逐条钉住"什么必须改变指纹、什么必须不改变指纹"。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fingerprintLibDir } from '../../scripts/sdk-lib-fingerprint.mjs'

/** 每个用例一个独立临时根目录，避免相互污染。 */
const roots: string[] = []

function makeLib(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-lib-fp-'))
  roots.push(root)
  const lib = path.join(root, 'lib')
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(lib, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }
  fs.mkdirSync(lib, { recursive: true })
  return lib
}

afterEach(() => {
  while (roots.length) {
    const root = roots.pop()!
    try {
      fs.rmSync(root, { recursive: true, force: true })
    } catch {
      // 临时目录清理失败不该让用例红：被断言的是指纹语义，不是清理。
    }
  }
})

describe('fingerprintLibDir —— 什么必须改变指纹', () => {
  it('改一个字节 ⇒ 指纹变（这是它存在的理由）', async () => {
    const a = await fingerprintLibDir(makeLib({ 'index.js': 'export const x = 1\n' }))
    const b = await fingerprintLibDir(makeLib({ 'index.js': 'export const x = 2\n' }))
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('**同长度**改内容 ⇒ 也必须变（只比 size 的判据会漏掉这种）', async () => {
    const a = await fingerprintLibDir(makeLib({ 'index.js': 'const xx = 1\n' }))
    const b = await fingerprintLibDir(makeLib({ 'index.js': 'const xy = 1\n' }))
    expect(a).not.toBe(b)
  })

  it('新增文件 ⇒ 变（W-07 型"旧产物少了/多了东西"的常见形态）', async () => {
    const a = await fingerprintLibDir(makeLib({ 'index.js': 'x' }))
    const b = await fingerprintLibDir(makeLib({ 'index.js': 'x', 'extra.js': 'x' }))
    expect(a).not.toBe(b)
  })

  it('删除文件 ⇒ 变', async () => {
    const a = await fingerprintLibDir(makeLib({ 'index.js': 'x', 'gone.js': 'x' }))
    const b = await fingerprintLibDir(makeLib({ 'index.js': 'x' }))
    expect(a).not.toBe(b)
  })

  it('改名（内容不变）⇒ 变', async () => {
    const a = await fingerprintLibDir(makeLib({ 'a.js': 'x' }))
    const b = await fingerprintLibDir(makeLib({ 'b.js': 'x' }))
    expect(a).not.toBe(b)
  })

  it('路径参与指纹：同样的内容放在不同子目录 ⇒ 不同', async () => {
    const a = await fingerprintLibDir(makeLib({ 'account/index.js': 'x' }))
    const b = await fingerprintLibDir(makeLib({ 'room/index.js': 'x' }))
    expect(a).not.toBe(b)
  })

  it('子目录里的改动也参与（递归到底）', async () => {
    const a = await fingerprintLibDir(makeLib({ 'a/b/c/index.d.ts': 'export {}' }))
    const b = await fingerprintLibDir(makeLib({ 'a/b/c/index.d.ts': 'export {  }' }))
    expect(a).not.toBe(b)
  })
})

describe('fingerprintLibDir —— 什么**不**该改变指纹', () => {
  it('同样内容的文件树 ⇒ 稳定同值（可重复调用）', async () => {
    const lib = makeLib({ 'index.js': 'x', 'a/index.js': 'y' })
    expect(await fingerprintLibDir(lib)).toBe(await fingerprintLibDir(lib))
  })

  it('跨进程/跨设备稳定：两棵独立创建的等价树 ⇒ 同指纹（排序必须生效）', async () => {
    // 若实现漏了全局排序，`readdirSync` 的顺序差异会让这两次算出不同值 ——
    // 那会变成"同一份产物在两台机器上指纹不同"的假红。
    const a = await fingerprintLibDir(makeLib({ 'z.js': '1', 'a.js': '2', 'm/n.js': '3' }))
    const b = await fingerprintLibDir(makeLib({ 'a.js': '2', 'm/n.js': '3', 'z.js': '1' }))
    expect(a).toBe(b)
  })

  it('并发路数不影响结果（实现细节不得泄漏进指纹）', async () => {
    const lib = makeLib({ 'a.js': '1', 'b.js': '2', 'c/d.js': '3' })
    expect(await fingerprintLibDir(lib, { concurrency: 1 })).toBe(await fingerprintLibDir(lib, { concurrency: 8 }))
  })
})

describe('fingerprintLibDir —— 不可知时必须给 null（交调用方 fail-closed）', () => {
  it('目录不存在 ⇒ null', async () => {
    expect(await fingerprintLibDir(path.join(os.tmpdir(), 'definitely-not-here-xyz'))).toBeNull()
  })

  it('空目录 ⇒ null（"没有文件"不能与"已核对一致"混为一谈）', async () => {
    expect(await fingerprintLibDir(makeLib({}))).toBeNull()
  })

  it('传的是文件而不是目录 ⇒ null', async () => {
    const lib = makeLib({ 'index.js': 'x' })
    expect(await fingerprintLibDir(path.join(lib, 'index.js'))).toBeNull()
  })

  it('返回值形状是 `sha256-<64 hex>`', async () => {
    const fp = await fingerprintLibDir(makeLib({ 'index.js': 'x' }))
    expect(fp).toMatch(/^sha256-[a-f0-9]{64}$/)
  })
})
