/** 服务端 `m.login.sso` flow 中声明的 IdP（CAP-03） */
export interface SsoIdentityProvider {
  id: string
  name?: string
  brand?: string
  icon?: string
}

/**
 * 规范化服务端返回的 `identity_providers` 数组。
 *
 * 后端字段是任意 JSON：缺 `id`（非字符串或空串）的条目直接丢弃，
 * 其余可选字段仅在为非空字符串时保留。
 */
export function parseSsoProviders(providers: unknown[]): SsoIdentityProvider[] {
  return providers.flatMap((provider) => {
    const id = (provider as { id?: unknown })?.id
    if (typeof id !== 'string' || id.length === 0) {
      return []
    }
    const name = (provider as { name?: unknown })?.name
    const brand = (provider as { brand?: unknown })?.brand
    const icon = (provider as { icon?: unknown })?.icon
    return [
      {
        id,
        ...(typeof name === 'string' && name.length > 0 ? { name } : {}),
        ...(typeof brand === 'string' && brand.length > 0 ? { brand } : {}),
        ...(typeof icon === 'string' && icon.length > 0 ? { icon } : {})
      }
    ]
  })
}
