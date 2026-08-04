import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 合理保留硬编码的文件（NaiveProvider 颜色运算、渐变、令牌定义、日志、stories 资源）
const ALLOWLIST_PATTERNS = [
  /NaiveProvider\.vue$/,
  /design-tokens\.css$/,
  /login-bg\.scss$/,
  /Logger\.ts$/,
  /Console\.ts$/,
  /[\\/]stories[\\/]/,
  /[\\/]assets[\\/]/,
  /\.svg$/,
  /__tests__[\\/]/,
  /\.test\.ts$/,
  /\.spec\.ts$/
]

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/g
// 匹配 CSS 变量 fallback 模式：var(--xxx, #yyyyyy) — 这种是合理的防御性 fallback
const CSS_VAR_FALLBACK_PATTERN = /var\([^)]*?,\s*#[0-9a-fA-F]{6}\s*\)/g

function isAllowlisted(filePath: string): boolean {
  return ALLOWLIST_PATTERNS.some((pattern) => pattern.test(filePath))
}

/** 计算纯硬编码色值数量（排除 CSS 变量 fallback 内的色值） */
function countPureHardcodedColors(content: string): number {
  const allMatches = content.match(HEX_COLOR_PATTERN) || []
  const fallbackMatches = content.match(CSS_VAR_FALLBACK_PATTERN) || []
  // fallback 模式中每个匹配只含 1 个色值
  return allMatches.length - fallbackMatches.length
}

describe('hardcoded color lint', () => {
  it('key component files should not contain pure 6-digit hex colors (excluding CSS var fallbacks)', () => {
    const keyFiles = [
      'src/mobile/components/message/MobileReactionPicker.vue',
      'src/mobile/views/chat-room/LocationShare.vue',
      'src/mobile/views/AddGroupQRCode.vue',
      'src/mobile/views/chat-room/MobileForwardDialog.vue',
      'src/components/friend/FriendListItem.vue',
      'src/components/rightBox/RoomMembersPane.vue',
      'src/components/room/RoomRetentionPanel.vue',
      'src/components/room/RoomCapabilitiesPanel.vue',
      'src/components/room/EventSignaturePanel.vue',
      'src/components/encryption/SecurityKeySetupDialog.vue'
    ]

    const violations: string[] = []
    for (const relPath of keyFiles) {
      if (isAllowlisted(relPath)) continue
      const absPath = join(process.cwd(), relPath)
      if (!existsSync(absPath)) continue
      const content = readFileSync(absPath, 'utf8')
      const pureCount = countPureHardcodedColors(content)
      if (pureCount > 0) {
        violations.push(`${relPath}: ${pureCount} pure hex colors found`)
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
