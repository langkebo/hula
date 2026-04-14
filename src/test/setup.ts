import { afterAll, beforeAll, beforeEach, vi } from 'vitest'

afterAll(() => {
  // 清理所有测试后的状态
})

beforeAll(() => {
  // 每个测试前的准备工作
})

beforeEach(() => {
  // 每个测试前的准备工作
})

// 全局测试工具函数
export function createMockClient(overrides = {}) {
  return {
    getUserId: () => '@test:example.com',
    getDeviceId: () => 'TEST_DEVICE',
    getAccessToken: () => 'test_token',
    getHomeserverUrl: () => 'https://test.example.com',
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$event123' }),
    sendStateEvent: vi.fn().mockResolvedValue({}),
    getRoom: vi.fn().mockReturnValue(null),
    on: vi.fn(),
    removeListener: vi.fn(),
    ...overrides
  }
}

export function mockLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key])
    })
  }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query
  }))
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
