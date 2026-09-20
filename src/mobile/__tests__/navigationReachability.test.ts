import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 移动端导航可达性守卫。
 *
 * 背景（实测缺陷）：`SecuritySettings.vue` 的「已忽略用户」单元格
 * `router.push('/mobile/mobileMy/ignoredUsers')`，但**该路由从未注册**，
 * 对应的视图文件也不存在——用户点击后什么都不发生（vue-router 控制台只报
 * 一行 warn）。同类问题还有 `/mobile/mobileMy/simpleBio`。
 *
 * 这类缺陷 vue-tsc 与单元测试都看不见：字符串路径既不受类型检查约束，
 * 测试也只是断言「push 被调用」，不会验证目标是否存在。本守卫直接对
 * 「源码里 push 的路径」与「路由表实际注册的路径」做差集。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')
const MOBILE_ROOT = join(REPO_ROOT, 'src/mobile')
const ROUTES_FILE = join(REPO_ROOT, 'src/router/routes/mobile.ts')
const SETTINGS_ROUTES_FILE = join(REPO_ROOT, 'src/mobile/views/my/settingsRoutes.ts')
const SETTINGS_SCHEMA_FILE = join(REPO_ROOT, 'src/stores/domains/settings/settingsSchema.ts')

/** 递归收集 .vue 文件（跳过测试目录） */
function collectVueFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectVueFiles(full, acc)
    } else if (entry.endsWith('.vue')) {
      acc.push(full)
    }
  }
  return acc
}

/** 源码中所有 `router.push('/mobile/...')` 的目标 */
function collectPushTargets(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const file of collectVueFiles(MOBILE_ROOT)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/router\.push\('(\/mobile\/[^']+)'\)/g)) {
      const list = map.get(m[1]) ?? []
      list.push(file.replace(`${REPO_ROOT}/`, ''))
      map.set(m[1], list)
    }
  }
  return map
}

/**
 * 路由表注册的路径集合（拼上父级前缀）。
 *
 * 只做「末段是否被注册过」的粗粒度校验：本文件里嵌套路由的 path 是相对段，
 * 逐层拼绝对路径需要解析 AST，收益不划算——末段唯一性在本仓成立。
 */
function registeredSegments(): Set<string> {
  const constantsSrc = readFileSync(SETTINGS_ROUTES_FILE, 'utf8')
  const src = readFileSync(ROUTES_FILE, 'utf8')

  // 1) 常量映射：只取 MOBILE_SETTINGS_RELATIVE_PATHS 对象块内的字面量键值，
  //    否则会把路由里的 `name: 'xxx'` 也当成常量（实测踩过这个坑）。
  const blockMatch = constantsSrc.match(/MOBILE_SETTINGS_RELATIVE_PATHS\s*=\s*\{([\s\S]*?)\}\s*as const/)
  const constantMap = new Map<string, string>()
  for (const m of (blockMatch?.[1] ?? '').matchAll(/([A-Za-z0-9_]+):\s*'([^']+)'/g)) {
    constantMap.set(m[1], m[2])
  }
  // 非字面量取值（如 `labs: SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs`）：从
  // settingsSchema 里解析它引用的常量对象，取其**值**。
  // 关键：只登记「值」，绝不登记键名——否则差集会退化成「键存在即通过」，
  // 把常量值改错也测不出来（实测踩过这个假阴性）。
  const schemaSrc = readFileSync(SETTINGS_SCHEMA_FILE, 'utf8')
  for (const m of (blockMatch?.[1] ?? '').matchAll(/([A-Za-z0-9_]+):\s*([A-Z_]+)\.([A-Za-z0-9_]+)/g)) {
    const [, , objectName, prop] = m
    const objMatch = schemaSrc.match(new RegExp(`${objectName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`))
    const propMatch = objMatch?.[1]?.match(new RegExp(`${prop}:\\s*'([^']+)'`))
    if (propMatch) {
      constantMap.set(m[1], propMatch[1])
    }
  }

  const segments = new Set<string>()

  /** 把 `MOBILE_SETTINGS_RELATIVE_PATHS.xxx` 替换成其字面量取值 */
  const resolve = (pathLike: string): string =>
    pathLike.replace(
      /[A-Za-z0-9_]*RELATIVE_PATHS\.([A-Za-z0-9_]+)/g,
      (_all, key: string) => constantMap.get(key) ?? `__UNRESOLVED_${key}__`
    )

  const addPath = (raw: string): void => {
    const p = resolve(raw)
    if (!p || p.startsWith('__UNRESOLVED')) {
      // 解析不到说明常量被改名/删除——这是真实漂移，登记为不可达以暴露问题
      segments.add(p)
      return
    }
    segments.add(p)
    segments.add(p.replace(/^\//, ''))
    const last = p.split('/').filter(Boolean).pop()
    if (last) segments.add(last)
  }

  // 2) 字面量 path
  for (const m of src.matchAll(/path:\s*'([^']*)'/g)) addPath(m[1])
  // 3) 常量引用 path: MOBILE_SETTINGS_RELATIVE_PATHS.xxx（无引号）
  for (const m of src.matchAll(/path:\s*([A-Za-z0-9_.]+)\s*[,}]/g)) {
    const key = m[1].split('.').pop() ?? ''
    const value = constantMap.get(key)
    addPath(value ?? `__UNRESOLVED_${key}__`)
  }
  return segments
}

describe('移动端导航可达性', () => {
  it('源码中 push 的移动端路径都必须命中已注册路由', () => {
    const segments = registeredSegments()
    const dead: string[] = []

    for (const [target, files] of collectPushTargets()) {
      const last = target.split('/').filter(Boolean).pop() ?? ''
      if (!segments.has(last)) {
        dead.push(`${target}  (来自 ${files.join(', ')})`)
      }
    }

    expect(dead).toEqual([])
  })

  it('守卫自检：能收集到足够多的目标，避免正则失效导致空转', () => {
    // 收集器失效时差集恒为空 → 守卫静默通过，必须自检
    expect(collectPushTargets().size).toBeGreaterThan(10)
  })
})
