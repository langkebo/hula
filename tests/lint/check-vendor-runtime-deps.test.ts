import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  VENDOR_RUNTIME_DEPS,
  evaluateVendorRuntimeDeps,
  extractOptimizeDepsInclude
} from '../../scripts/check-vendor-runtime-deps.mjs'

const projectRoot = join(__dirname, '..', '..')
const packageJsonFile = join(projectRoot, 'package.json')
const viteConfigFile = join(projectRoot, 'build', 'config', 'vite.config.base.ts')

function pkgWith(dependencies: Record<string, string>) {
  return { dependencies }
}

function fullDeps() {
  return Object.fromEntries(VENDOR_RUNTIME_DEPS.map((dep) => [dep, '*']))
}

describe('check-vendor-runtime-deps: evaluateVendorRuntimeDeps', () => {
  it('两处齐全时通过', () => {
    const result = evaluateVendorRuntimeDeps({
      pkg: pkgWith(fullDeps()),
      optimizeDepsInclude: [...VENDOR_RUNTIME_DEPS]
    })
    expect(result.ok).toBe(true)
    expect(result.missingFromDependencies).toEqual([])
    expect(result.missingFromOptimizeDeps).toEqual([])
  })

  it('缺失一个 dependency 时失败且只报该包', () => {
    const deps = fullDeps()
    delete deps['events']
    const result = evaluateVendorRuntimeDeps({
      pkg: pkgWith(deps),
      optimizeDepsInclude: [...VENDOR_RUNTIME_DEPS]
    })
    expect(result.ok).toBe(false)
    expect(result.missingFromDependencies).toEqual(['events'])
    expect(result.missingFromOptimizeDeps).toEqual([])
  })

  it('缺失一个 optimizeDeps.include 项时失败且只报该包', () => {
    const result = evaluateVendorRuntimeDeps({
      pkg: pkgWith(fullDeps()),
      optimizeDepsInclude: VENDOR_RUNTIME_DEPS.filter((dep) => dep !== 'sdp-transform')
    })
    expect(result.ok).toBe(false)
    expect(result.missingFromDependencies).toEqual([])
    expect(result.missingFromOptimizeDeps).toEqual(['sdp-transform'])
  })

  it('两处同时缺失时双列皆报', () => {
    const deps = fullDeps()
    delete deps['content-type']
    delete deps['loglevel']
    const result = evaluateVendorRuntimeDeps({
      pkg: pkgWith(deps),
      optimizeDepsInclude: ['events']
    })
    expect(result.ok).toBe(false)
    expect(result.missingFromDependencies).toEqual(['content-type', 'loglevel'])
    expect(result.missingFromOptimizeDeps).toEqual([
      'content-type',
      'loglevel',
      'matrix-events-sdk',
      'matrix-widget-api',
      'sdp-transform'
    ])
  })

  it('空输入不抛错但全列缺失', () => {
    const result = evaluateVendorRuntimeDeps({})
    expect(result.ok).toBe(false)
    expect(result.missingFromDependencies).toEqual(VENDOR_RUNTIME_DEPS)
  })
})

describe('check-vendor-runtime-deps: extractOptimizeDepsInclude', () => {
  it('从源码文本提取 include 数组字符串字面量', () => {
    const source = `
      export default {
        optimizeDeps: {
          exclude: ['matrix-js-sdk'],
          include: ['vue', 'events', 'loglevel'],
          other: true
        }
      }
    `
    expect(extractOptimizeDepsInclude(source)).toEqual(['vue', 'events', 'loglevel'])
  })

  it('兼容双引号字面量', () => {
    const source = `optimizeDeps: { include: ["content-type", "sdp-transform"] }`
    expect(extractOptimizeDepsInclude(source)).toEqual(['content-type', 'sdp-transform'])
  })

  it('缺失 optimizeDeps 时抛错', () => {
    expect(() => extractOptimizeDepsInclude('export default {}')).toThrow(/optimizeDeps/)
  })

  it('缺失 include 时抛错', () => {
    expect(() => extractOptimizeDepsInclude('optimizeDeps: { exclude: [] }')).toThrow(/include/)
  })
})

describe('check-vendor-runtime-deps: 真实仓库自洽', () => {
  it('当前仓库两处均已绑定 6 个运行期依赖', () => {
    const pkg = JSON.parse(readFileSync(packageJsonFile, 'utf8'))
    const source = readFileSync(viteConfigFile, 'utf8')
    const result = evaluateVendorRuntimeDeps({
      pkg,
      optimizeDepsInclude: extractOptimizeDepsInclude(source)
    })
    expect(result.missingFromDependencies).toEqual([])
    expect(result.missingFromOptimizeDeps).toEqual([])
    expect(result.ok).toBe(true)
  })
})
