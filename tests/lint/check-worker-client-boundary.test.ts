import { describe, expect, it } from 'vitest'
import {
  collectSourceFiles,
  FORBIDDEN_SDK_IMPORT,
  HOST_FILE,
  isExcludedPath,
  REMOVED_MESSAGE_TYPES,
  scanSources,
  WORKER_ENTRY_FILE
} from '../../scripts/check-worker-client-boundary.mjs'

const WORKER_UTIL = 'src/workers/workerState.ts'
const _WORKER_SEARCH = 'src/workers/workerSearchHandlers.ts'

function repo(extra: Array<{ path: string; content: string }> = []) {
  return [
    { path: WORKER_ENTRY_FILE, content: 'const messageHandlers: Record<string, HandlerFn> = { ping: () => ({}) }' },
    { path: HOST_FILE, content: "async ping() { return this.request('ping') }" },
    ...extra
  ]
}

describe('check-worker-client-boundary — 纯函数判据', () => {
  it('合规仓库通过，并报出扫描文件数', () => {
    const result = scanSources(repo([{ path: WORKER_UTIL, content: 'export async function sendResponse() {}' }]))

    expect(result.ok).toBe(true)
    expect(result.checkedFiles).toBe(3)
    expect(result.violations).toEqual([])
    expect(result.missing).toEqual([])
  })

  it('worker 静态 import matrix-js-sdk ⇒ 判违规（worker 不装 SDK）', () => {
    const result = scanSources(
      repo([{ path: WORKER_UTIL, content: `import type { MatrixClient } from '${FORBIDDEN_SDK_IMPORT}'` }])
    )

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({ path: WORKER_UTIL, kind: 'worker-sdk-import' })
  })

  it('worker 动态 import 也判违规（去空白后比对，跨行也拦得住）', () => {
    const result = scanSources(
      repo([{ path: WORKER_UTIL, content: `const loaded = await import(\n  '${FORBIDDEN_SDK_IMPORT}'\n)` }])
    )

    expect(result.ok).toBe(false)
    expect(result.violations[0].kind).toBe('worker-sdk-import')
  })

  it('注释里解释「为什么不 import matrix-js-sdk」不算违规', () => {
    const result = scanSources(
      repo([
        {
          path: WORKER_UTIL,
          content: [
            `// 本 worker 不 import ${FORBIDDEN_SDK_IMPORT}：搜索索引由主线程喂数据`,
            `/* 历史：曾 import type { MatrixClient } from '${FORBIDDEN_SDK_IMPORT}' */`,
            'export const x = 1'
          ].join('\n')
        }
      ])
    )

    expect(result.ok).toBe(true)
  })

  it('worker 重新声明 client 状态 ⇒ 判违规（引用 MatrixClient 类型即被拦）', () => {
    const result = scanSources(
      repo([{ path: WORKER_UTIL, content: 'export const state = { client: null as MatrixClient | null }' }])
    )

    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.token)).toContain('MatrixClient')
    expect(result.violations.every((v) => v.kind === 'worker-client-state')).toBe(true)
  })

  it('worker 重新赋值 state.client / createClient ⇒ 两路 token 都命中', () => {
    const result = scanSources(repo([{ path: WORKER_UTIL, content: 'state.client = sdk.createClient(clientOpts)' }]))

    expect(result.ok).toBe(false)
    const tokens = result.violations.map((v) => v.token)
    expect(tokens).toContain('state.client')
    expect(tokens).toContain('createClient(')
  })

  it('worker 重新 createClient ⇒ 判违规', () => {
    const result = scanSources(repo([{ path: WORKER_UTIL, content: 'const c = sdk.createClient(clientOpts)' }]))

    expect(result.ok).toBe(false)
    expect(result.violations.some((v) => v.token === 'createClient(')).toBe(true)
  })

  it('分发表重新登记已删消息类型 ⇒ 判违规（worker-dispatch）', () => {
    const result = scanSources(
      repo([
        {
          path: WORKER_ENTRY_FILE,
          content:
            'const messageHandlers = { initialize: (p) => handleInitialize(p), startClient: () => handleStartClient() }'
        }
      ])
    )

    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.token).sort()).toEqual(['initialize', 'startClient'])
    expect(result.violations.every((v) => v.kind === 'worker-dispatch')).toBe(true)
  })

  it('主线程重新发送已删消息 ⇒ 判违规（host-request）', () => {
    const result = scanSources(
      repo([{ path: HOST_FILE, content: "async clearStores() { return this.request<void>('clearStores') }" }])
    )

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({ path: HOST_FILE, kind: 'host-request', token: 'clearStores' })
  })

  it('注释里提到已删消息类型不算违规（保留「为什么删」的知识）', () => {
    const result = scanSources(
      repo([{ path: HOST_FILE, content: '// 原先这里有 clearStores()，Batch 3.2 删除（worker 从不持有 client）' }])
    )

    expect(result.ok).toBe(true)
  })

  it('关键文件缺失 ⇒ missing（由 CLI 升级为 EXIT=2）', () => {
    const result = scanSources([{ path: WORKER_UTIL, content: 'export const x = 1' }])

    expect(result.ok).toBe(false)
    expect(result.missing).toEqual([WORKER_ENTRY_FILE, HOST_FILE])
  })

  it('非 worker 目录的文件不参与扫描', () => {
    const result = scanSources(
      repo([{ path: 'src/services/matrix/MatrixWorkerHost2.ts', content: `import from '${FORBIDDEN_SDK_IMPORT}'` }])
    )

    expect(result.checkedFiles).toBe(2)
    expect(result.ok).toBe(true)
  })

  it('测试文件被排除', () => {
    expect(isExcludedPath('src/workers/__tests__/workerClientHandlers.test.ts')).toBe(true)
    expect(isExcludedPath(WORKER_UTIL)).toBe(false)
  })
})

describe('check-worker-client-boundary — 真实仓库自洽', () => {
  let cached: ReturnType<typeof collectSourceFiles> | null = null
  const files = () => (cached ??= collectSourceFiles('src/workers'))

  it('本仓 worker 目录不含 SDK 依赖与 client 持有面', () => {
    const collected = files()
    const known = new Set(collected.map((f) => f.path))
    const all = [...collected]
    for (const rel of [WORKER_ENTRY_FILE, HOST_FILE]) {
      if (!known.has(rel)) all.push({ path: rel, content: '' })
    }

    const result = scanSources(all)

    expect(result.violations).toEqual([])
    expect(result.missing).toEqual([])
    expect(result.checkedFiles).toBeGreaterThanOrEqual(5)
  })

  it('已删消息类型清单与取证报告一致（7 条）', () => {
    expect(REMOVED_MESSAGE_TYPES).toHaveLength(7)
    expect(REMOVED_MESSAGE_TYPES).toContain('clearStores')
    expect(REMOVED_MESSAGE_TYPES).toContain('getStats')
  })
})
