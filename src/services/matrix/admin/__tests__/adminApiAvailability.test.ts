import { describe, expect, it } from 'vitest'
import {
  type AdminApiAvailability,
  classifyAdminApiProbe,
  describeAdminApiAvailability,
  filterAdminNavGroups,
  readOptionalCapabilityFlag,
  resolveAdminNavState
} from '../adminApiAvailability'

/** 线上真实错误形状（来自 2026-10-13 `pnpm td` 日志的 `dumps()`） */
const FORBIDDEN_403 = Object.assign(new Error('Admin API forbidden'), {
  name: 'ApiError',
  errorCode: 'M_FORBIDDEN',
  statusCode: 403,
  isRetryable: false
})

describe('classifyAdminApiProbe', () => {
  it('无异常 ⇒ available', () => {
    const result = classifyAdminApiProbe(null)
    expect(result).toMatchObject({ status: 'available', apiPresent: true, authorized: true })
  })

  it('403 M_FORBIDDEN ⇒ forbidden，且 apiPresent=true（**不是**后端不可用）', () => {
    const result = classifyAdminApiProbe(FORBIDDEN_403)
    expect(result.status).toBe('forbidden')
    expect(result.statusCode).toBe(403)
    expect(result.errorCode).toBe('M_FORBIDDEN')
    expect(result.apiPresent).toBe(true)
    expect(result.authorized).toBe(false)
  })

  it('只有状态码 403（无 errcode）也归为 forbidden', () => {
    const result = classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 403 }))
    expect(result.status).toBe('forbidden')
  })

  it('401 / M_UNKNOWN_TOKEN ⇒ unauthorized（API 可达，凭证问题）', () => {
    expect(classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 401 })).status).toBe('unauthorized')
    const byCode = classifyAdminApiProbe(Object.assign(new Error('x'), { errorCode: 'M_UNKNOWN_TOKEN' }))
    expect(byCode.status).toBe('unauthorized')
    expect(byCode.apiPresent).toBe(true)
  })

  it('404 / M_UNRECOGNIZED ⇒ unsupported（该 homeserver 没有 Admin API）', () => {
    const byCode = classifyAdminApiProbe(Object.assign(new Error('x'), { errorCode: 'M_UNRECOGNIZED' }))
    expect(byCode.status).toBe('unsupported')
    expect(byCode.apiPresent).toBe(false)

    const byStatus = classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 404 }))
    expect(byStatus.status).toBe('unsupported')
    expect(byStatus.apiPresent).toBe(false)
  })

  it('errCode 优先于状态码（反代改写状态码时仍按 errcode 归类）', () => {
    const result = classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 500, errorCode: 'M_FORBIDDEN' }))
    expect(result.status).toBe('forbidden')
    expect(result.statusCode).toBe(500)
  })

  it('5xx / 无状态码 / 网络错误 ⇒ unavailable，且 apiPresent 为 null（不得断言"没有 Admin API"）', () => {
    const serverError = classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 503 }))
    expect(serverError.status).toBe('unavailable')
    expect(serverError.apiPresent).toBeNull()

    const network = classifyAdminApiProbe(new Error('Failed to fetch'))
    expect(network.status).toBe('unavailable')
    expect(network.statusCode).toBeNull()
    expect(network.apiPresent).toBeNull()
  })

  it('其它 4xx ⇒ 服务端确实回答了（apiPresent=true），但不断言无权限', () => {
    const result = classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 400 }))
    expect(result.status).toBe('unavailable')
    expect(result.apiPresent).toBe(true)
    expect(result.authorized).toBe(false)
  })

  it('把该 homeserver 判定为"未提供 Admin API"只能靠 unsupported，不能用 unavailable', () => {
    const unavailable = classifyAdminApiProbe(new Error('boom'))
    expect(unavailable.status).not.toBe('unsupported')
    expect(unavailable.apiPresent).toBeNull()
  })
})

describe('describeAdminApiAvailability', () => {
  it('forbidden 的文案点明「可达 + 无权限」，且不含「不可用」', () => {
    const text = describeAdminApiAvailability(classifyAdminApiProbe(FORBIDDEN_403))
    expect(text).toContain('可达')
    expect(text).toContain('管理员权限')
    expect(text).toContain('403')
    expect(text).toContain('M_FORBIDDEN')
    expect(text).not.toContain('不可用')
  })

  it('unsupported 说明「未提供」，不含「不可用」', () => {
    const text = describeAdminApiAvailability(classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 404 })))
    expect(text).toContain('未提供 Admin API')
    expect(text).not.toContain('不可用')
  })

  it('unavailable 才允许出现「无法判定」，并带出状态码', () => {
    const text = describeAdminApiAvailability(classifyAdminApiProbe(Object.assign(new Error('x'), { statusCode: 503 })))
    expect(text).toContain('无法判定')
    expect(text).toContain('503')
  })

  it('available 文案简洁', () => {
    expect(describeAdminApiAvailability(classifyAdminApiProbe(null))).toBe('Admin API 可用')
  })
})

function availability(status: AdminApiAvailability['status']): AdminApiAvailability {
  return { status, statusCode: null, errorCode: null, apiPresent: null, authorized: status === 'available' }
}

describe('resolveAdminNavState', () => {
  it('尚未探测完成 ⇒ loading（不是 unavailable）', () => {
    expect(resolveAdminNavState(null, false)).toBe('loading')
    expect(resolveAdminNavState(availability('available'), false)).toBe('loading')
  })

  it('探测完成但无结果 ⇒ unavailable', () => {
    expect(resolveAdminNavState(null, true)).toBe('unavailable')
    expect(resolveAdminNavState(undefined, true)).toBe('unavailable')
  })

  it('available 映射为 ready，其余状态原样透出', () => {
    expect(resolveAdminNavState(availability('available'), true)).toBe('ready')
    expect(resolveAdminNavState(availability('forbidden'), true)).toBe('forbidden')
    expect(resolveAdminNavState(availability('unauthorized'), true)).toBe('unauthorized')
    expect(resolveAdminNavState(availability('unsupported'), true)).toBe('unsupported')
    expect(resolveAdminNavState(availability('unavailable'), true)).toBe('unavailable')
  })
})

describe('readOptionalCapabilityFlag', () => {
  it('unstable_features 缺失 ⇒ null（未知，调用方保留可见）', () => {
    expect(readOptionalCapabilityFlag('saml', null)).toBeNull()
    expect(readOptionalCapabilityFlag('saml', undefined)).toBeNull()
  })

  it('标志未发布 ⇒ null，不得当成 false', () => {
    expect(readOptionalCapabilityFlag('saml', { 'io.hula.oidc': true })).toBeNull()
  })

  it('标志明确发布时以标志为准', () => {
    expect(readOptionalCapabilityFlag('saml', { 'io.hula.saml': true })).toBe(true)
    expect(readOptionalCapabilityFlag('saml', { 'io.hula.saml': false })).toBe(false)
    expect(readOptionalCapabilityFlag('modules', { 'io.hula.modules': false })).toBe(false)
  })
})

interface TestItem {
  path: string
  optionalCapability?: 'saml' | 'oidc' | 'worker' | 'modules'
}

describe('filterAdminNavGroups', () => {
  const groups = [
    { label: 'core', items: [{ path: '/admin/users' }, { path: '/admin/rooms' }] as TestItem[] },
    {
      label: 'ext',
      items: [{ path: '/admin/saml', optionalCapability: 'saml' } as TestItem]
    }
  ]

  it('非 ready 状态一律返回空（不渲染菜单）', () => {
    for (const state of ['loading', 'forbidden', 'unauthorized', 'unsupported', 'unavailable'] as const) {
      expect(filterAdminNavGroups(groups, state, () => true)).toEqual([])
    }
  })

  it('ready 时保留全部条目', () => {
    const result = filterAdminNavGroups(groups, 'ready', () => true)
    expect(result.map((group) => group.label)).toEqual(['core', 'ext'])
    expect(result[1].items).toHaveLength(1)
  })

  it('可选能力明确关闭时剔除该条目，空分组整组隐藏', () => {
    const result = filterAdminNavGroups(groups, 'ready', () => false)
    expect(result.map((group) => group.label)).toEqual(['core'])
  })

  it('可选能力未知（null）时保留条目', () => {
    const result = filterAdminNavGroups(groups, 'ready', () => null)
    expect(result.map((group) => group.label)).toEqual(['core', 'ext'])
  })
})
