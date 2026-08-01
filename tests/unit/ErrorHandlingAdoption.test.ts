/**
 * Task 21: withErrorHandling adoption test
 *
 * 验证关键 L3 service 已采用 `withErrorHandling` 包装器，且不再依赖旧的
 * `normalizeSdkError`（sdk-errors）错误归一化路径。
 *
 * 本测试为采用率校验（file-content 级别），不验证运行时行为——后者由各 service
 * 自身的单元测试覆盖。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const TARGET_SERVICES = [
  'src/services/matrix/friends/MatrixFriendService.ts',
  'src/services/matrix/messaging/MatrixBurnAfterReadService.ts',
  'src/services/matrix/widget/MatrixWidgetService.ts'
]

describe('withErrorHandling adoption', () => {
  for (const servicePath of TARGET_SERVICES) {
    it(`${servicePath} imports withErrorHandling`, () => {
      const content = readFileSync(join(process.cwd(), servicePath), 'utf-8')
      expect(content).toContain('withErrorHandling')
    })
  }

  it('no service in src/services/matrix imports normalizeSdkError from sdk-errors', () => {
    const servicesDir = join(process.cwd(), 'src/services/matrix')
    const files = readdirSync(servicesDir, { recursive: true }).filter((f) => String(f).endsWith('.ts'))
    for (const file of files) {
      const content = readFileSync(join(servicesDir, String(file)), 'utf-8')
      expect(content, `${file} should not import normalizeSdkError`).not.toContain('normalizeSdkError')
    }
  })
})
