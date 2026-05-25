import { afterEach, describe, expect, it, vi } from 'vitest'

type MockPage = {
  waitForFunction: ReturnType<typeof vi.fn>
}

function createMockPage(overrides: Partial<MockPage> = {}): MockPage {
  return {
    waitForFunction: vi.fn(),
    ...overrides
  }
}

interface WaitForFunctionOptions {
  timeout?: number
}

async function waitForPinia(page: MockPage): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as Window & { __HULA_PINIA_READY__?: boolean; pinia?: unknown }).__HULA_PINIA_READY__ === true &&
      (window as Window & { pinia?: unknown }).pinia != null,
    undefined,
    { timeout: 30_000 }
  )
}

async function waitForHulaAppReady(page: MockPage): Promise<void> {
  await page.waitForFunction(
    () => (window as Window & { __HULA_APP_READY__?: boolean }).__HULA_APP_READY__ === true,
    undefined,
    { timeout: 120_000 }
  )
}

describe('E2E support utilities - matrixLive', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('waitForPinia', () => {
    it('should resolve when __HULA_PINIA_READY__ is true', async () => {
      const page = createMockPage()
      page.waitForFunction.mockImplementation(
        (_callback: () => boolean, _arg: undefined, _options: WaitForFunctionOptions) => {
          return Promise.resolve({ jsonValue: () => true })
        }
      )

      await waitForPinia(page)

      expect(page.waitForFunction).toHaveBeenCalledTimes(1)
      const [_callback, arg, options] = page.waitForFunction.mock.calls[0]
      expect(arg).toBeUndefined()
      expect(options).toEqual({ timeout: 30_000 })
    })

    it('should timeout if Pinia never becomes ready', async () => {
      const page = createMockPage()
      const timeoutError = new Error('page.waitForFunction: Timeout 30000ms exceeded')
      page.waitForFunction.mockRejectedValue(timeoutError)

      await expect(waitForPinia(page)).rejects.toThrow('Timeout')
      expect(page.waitForFunction).toHaveBeenCalledTimes(1)
      expect(page.waitForFunction.mock.calls[0][2]).toEqual({ timeout: 30_000 })
    })
  })

  describe('waitForHulaAppReady', () => {
    it('should resolve when __HULA_APP_READY__ is true', async () => {
      const page = createMockPage()
      page.waitForFunction.mockImplementation(
        (_callback: () => boolean, _arg: undefined, _options: WaitForFunctionOptions) => {
          return Promise.resolve({ jsonValue: () => true })
        }
      )

      await waitForHulaAppReady(page)

      expect(page.waitForFunction).toHaveBeenCalledTimes(1)
      const [_callback, arg, options] = page.waitForFunction.mock.calls[0]
      expect(arg).toBeUndefined()
      expect(options).toEqual({ timeout: 120_000 })
    })
  })
})
