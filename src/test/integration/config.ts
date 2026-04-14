/**
 * 集成测试配置
 * 用于与真实后端服务器进行交互测试
 */

export const INTEGRATION_TEST_CONFIG = {
  homeserverUrl: process.env.INTEGRATION_TEST_HOMESERVER || 'http://localhost:8008',
  testUserPrefix: 'test_integration_',
  adminUser: {
    username: process.env.INTEGRATION_TEST_ADMIN_USER || 'admin',
    password: process.env.INTEGRATION_TEST_ADMIN_PASSWORD || 'Admin@123'
  },
  testUser: {
    username: process.env.INTEGRATION_TEST_USER || 'testuser',
    password: process.env.INTEGRATION_TEST_USER_PASSWORD || 'TestPass123!'
  },
  timeout: {
    short: 5000,
    medium: 15000,
    long: 30000
  }
}

export function getTestHomeserverUrl(): string {
  return INTEGRATION_TEST_CONFIG.homeserverUrl
}

export function generateTestUserId(): string {
  return `${INTEGRATION_TEST_CONFIG.testUserPrefix}${Date.now()}_${Math.random().toString(36).substring(7)}`
}

export function isIntegrationTestEnabled(): boolean {
  return process.env.INTEGRATION_TEST === 'true' || process.env.CI === 'true'
}

export function skipIfNoIntegrationTest(): { skip: boolean; reason?: string } {
  if (!isIntegrationTestEnabled()) {
    return { skip: true, reason: 'Integration tests disabled. Set INTEGRATION_TEST=true to enable.' }
  }
  return { skip: false }
}
