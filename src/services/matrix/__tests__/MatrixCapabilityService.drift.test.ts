import { describe, expect, it } from 'vitest'
import {
  SYNAPSE_RUST_CAPABILITY_ALIASES,
  SYNAPSE_RUST_FEATURE_FALLBACK,
  SynapseRustFeature
} from '@/services/matrix/sdk'
import { HULA_CAPABILITY_ALIASES } from '../MatrixCapabilityService'

/**
 * 能力映射表的**真值漂移校验**（CAP-08 / S-01）。
 *
 * 现有 `MatrixCapabilityService.test.ts` 的 23 处 `store.setCapabilities({...})` 是**手写输入**：
 * 它们证明「给定这份输入时映射如此」，但无法证明「映射表和服务端/SDK 宣告的一致」。
 * 历史上 MSC3245 就踩过——服务端只宣告 `org.matrix.msc3245.voice`，本地若按无后缀写就永远 unsupported。
 *
 * 本文件把两侧对上：
 * 1）SDK **已绑定**的能力（`SynapseRustFeature` 里有的），其**全部 SDK 认可串**（主键 + 别名）
 *    都必须出现在 Tjg 的别名表里 —— SDK 改名时这里立刻红；
 * 2）SDK **未绑定**的能力（如 e2ee、admin-api 这类客户端判定位），
 *    必须在 `SDK_UNBOUND` 里写明理由，防止「悄悄清空别名」被当成通过；
 * 3）Tjg 允许比 SDK 多写别名（服务端兼容串），但多写的不能反过来冒充 SDK 真值。
 */

/** SDK 的 `SynapseRustFeature` 未绑定、但 Tjg 需要自行识别的能力（必须写清依据） */
const SDK_UNBOUND: Record<string, string> = {
  e2ee: '客户端能力，服务端 /capabilities 与 /versions 都不宣告（由 crypto 初始化态判定）',
  'admin-api': '管理员权限由 /_synapse/admin 的 is_admin 判定，不经 capabilities 面'
}

/** 服务端不宣告、因而别名表必须留空的能力位（有明确依据才允许） */
const EXPECTED_EMPTY = new Set(['e2ee', 'admin-api'])

const sdkFeatureValues = Object.values(SynapseRustFeature) as string[]

/** SDK 对某 feature 认可的全部字符串（主键 + 别名表） */
const sdkRecognizedFor = (feature: string): string[] => [
  feature,
  ...(SYNAPSE_RUST_CAPABILITY_ALIASES[feature as keyof typeof SYNAPSE_RUST_CAPABILITY_ALIASES] ?? [])
]

describe('能力映射表与 SDK 真值一致', () => {
  it('SDK 已绑定的能力，其 SDK 认可串必须全部出现在 Tjg 别名表里', () => {
    const drift: Array<{ capability: string; missing: string[] }> = []

    for (const [capability, aliases] of Object.entries(HULA_CAPABILITY_ALIASES)) {
      const own = new Set([...aliases.unstable, ...aliases.capabilities])
      for (const feature of sdkFeatureValues) {
        // 只比对「Tjg 确实在用这个 feature」的能力位（交集非空）
        if (!own.has(feature)) continue
        const missing = sdkRecognizedFor(feature).filter((key) => !own.has(key))
        if (missing.length > 0) drift.push({ capability, missing })
      }
    }

    expect(drift).toEqual([])
  })

  it('SDK 未绑定的能力位必须在 SDK_UNBOUND 里登记理由', () => {
    const unregistered = Object.entries(HULA_CAPABILITY_ALIASES)
      .filter(([, aliases]) => {
        const own = [...aliases.unstable, ...aliases.capabilities]
        return !own.some((key) => (sdkFeatureValues as string[]).includes(key))
      })
      .map(([capability]) => capability)
      .filter((capability) => !SDK_UNBOUND[capability])

    expect(unregistered).toEqual([])
  })

  it('留空的能力位只允许是显式登记的（防止悄悄清空别名）', () => {
    const emptied = Object.entries(HULA_CAPABILITY_ALIASES)
      .filter(([, aliases]) => aliases.unstable.length === 0 && aliases.capabilities.length === 0)
      .map(([capability]) => capability)
      .filter((capability) => !EXPECTED_EMPTY.has(capability))

    expect(emptied).toEqual([])
  })

  it('SDK 真值本身可用：feature 非空且 fallback 覆盖全部 feature', () => {
    expect(sdkFeatureValues.length).toBeGreaterThanOrEqual(8)
    for (const feature of sdkFeatureValues) {
      expect(Object.hasOwn(SYNAPSE_RUST_FEATURE_FALLBACK, feature)).toBe(true)
    }
  })

  it('MSC3245 语音：主键带 .voice 后缀，且服务端别名一并识别', () => {
    expect(SynapseRustFeature.Voice).toBe('org.matrix.msc3245.voice')
    expect(HULA_CAPABILITY_ALIASES.voip.unstable).toContain(SynapseRustFeature.Voice)
    // 服务端 /versions 只给无后缀那条、/capabilities 给 m.voice，三者任一都要能命中
    expect(HULA_CAPABILITY_ALIASES.voip.unstable).toContain('org.matrix.msc3245')
    expect(HULA_CAPABILITY_ALIASES.voip.capabilities).toContain('m.voice')
  })
})
