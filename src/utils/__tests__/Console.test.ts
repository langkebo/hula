import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockPkg = vi.hoisted(() => ({
  default: {
    name: 'test-hula',
    version: '9.9.9',
    author: { email: 'test@example.com' }
  }
}))

vi.mock('../../../package.json', () => mockPkg)

import { consolePrint } from '../Console'

describe('consolePrint', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('calls console.log', () => {
    consolePrint()

    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('output includes pkg.name and pkg.version', () => {
    consolePrint()

    const firstArg = String(logSpy.mock.calls[0][0])
    expect(firstArg).toContain('test-hula')
    expect(firstArg).toContain('9.9.9')
  })
})
