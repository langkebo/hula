/**
 * 关键扩展清单派生 —— 从 SDK 权威扩展注册表生成运行时探针 ID。
 *
 * 背景：SDK 的 `DEFAULT_CORE_EXTENSIONS`（AUTO-GENERATED）是「哪些 Manager 扩展
 * 会被注册」的单一真相。手写 `CRITICAL_EXTENSION_IDS` 会随 SDK 升级悄悄漏检
 * 新增扩展，本模块改为直接派生，使「新增扩展未登记」无法通过用例。
 *
 * 探针 ID 采用访问器名（如 `getFriendManager`）而非 kebab 名，理由：
 * 1. 可从扩展清单 1:1 派生，无歧义；
 * 2. 语义自描述，与运行时鸭子类型探针字段完全一致。
 *
 * @see src/services/matrix/sdk.ts — SDK 唯一咽喉点（转发 DEFAULT_CORE_EXTENSIONS）
 */

import { DEFAULT_CORE_EXTENSIONS, type ManagerExtensionsOptions, type MatrixClient } from '@/services/matrix/sdk'

/**
 * 访问器名与扩展选项名不一致的显式白名单。
 *
 * 扩展清单中绝大多数选项遵循 `include<Pascal>` → `get<Pascal>Manager` 的命名规则，
 * 仅有以下 3 项例外，必须显式映射到实际注册的访问器名（已对照 SDK
 * `matrix-client-extensions` 声明逐条核验，无其它不规则项）。
 */
export const EXTENSION_ACCESSOR_OVERRIDES: Readonly<Record<string, string>> = {
  includeDm: 'getDirectMessageManager',
  includeSyncManagement: 'getSyncManager',
  includeTagsManagement: 'getTagsManager'
}

/** FriendManager 探针 ID —— 保留专用降级遥测契约（friend_manager_degraded）。 */
export const FRIEND_EXTENSION_ID = 'getFriendManager'

/**
 * 将扩展清单中的选项名转换为 client 上的访问器名。
 *
 * @param option `includeXxx` 形式的扩展选项名
 * @returns 对应的访问器名（如 `getXxxManager`）
 */
export function extensionOptionToAccessor(option: string): string {
  const override = EXTENSION_ACCESSOR_OVERRIDES[option]
  if (override) return override
  return `get${option.replace(/^include/, '')}Manager`
}

/**
 * 从扩展清单派生全部访问器 ID（去重 + 稳定排序）。
 *
 * @param manifest 扩展清单，默认取 SDK `DEFAULT_CORE_EXTENSIONS`
 * @returns 访问器 ID 列表
 */
export function deriveExtensionAccessors(manifest: ManagerExtensionsOptions = DEFAULT_CORE_EXTENSIONS): string[] {
  const ids = new Set<string>()
  for (const option of Object.keys(manifest)) {
    ids.add(extensionOptionToAccessor(option))
  }
  return [...ids].sort()
}

/**
 * 关键扩展 ID —— 由 SDK 扩展清单派生，新增扩展自动纳入降级监控。
 *
 * 长度恒等于 `Object.keys(DEFAULT_CORE_EXTENSIONS).length`。
 */
export const CRITICAL_EXTENSION_IDS: readonly string[] = deriveExtensionAccessors()

/**
 * 检测单个扩展访问器是否已注册到 client（鸭子类型）。
 *
 * @param client MatrixClient 实例（可为 null）
 * @param accessor 访问器名（如 `getFriendManager`）
 * @returns 访问器是否为函数
 */
export function isExtensionRegistered(client: MatrixClient | null, accessor: string): boolean {
  if (!client) return false
  const candidate = client as MatrixClient & Record<string, unknown>
  return typeof candidate[accessor] === 'function'
}

/**
 * 找出未注册的扩展访问器列表。
 *
 * @param client MatrixClient 实例（可为 null）
 * @param accessors 待检查的访问器 ID 列表，默认全部关键扩展
 * @returns 未注册的访问器 ID 列表
 */
export function findUnregisteredExtensions(
  client: MatrixClient | null,
  accessors: readonly string[] = CRITICAL_EXTENSION_IDS
): string[] {
  return accessors.filter((accessor) => !isExtensionRegistered(client, accessor))
}
