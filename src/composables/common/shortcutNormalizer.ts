type ShortcutModifier = 'CommandOrControl' | 'Super' | 'Alt' | 'Shift'

/** 修饰键别名 → 插件合法修饰键（C-10）。`Meta` 在插件侧非法，统一归一化。 */
const MODIFIER_ALIASES: Record<string, ShortcutModifier> = {
  cmd: 'CommandOrControl',
  command: 'CommandOrControl',
  commandorcontrol: 'CommandOrControl',
  ctrl: 'CommandOrControl',
  control: 'CommandOrControl',
  meta: 'CommandOrControl',
  super: 'Super',
  win: 'Super',
  windows: 'Super',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift'
}

/** 输出顺序固定，避免同一组合因输入顺序不同被当成两个值。 */
const MODIFIER_ORDER: ShortcutModifier[] = ['CommandOrControl', 'Super', 'Alt', 'Shift']

/** 普通键别名 → 插件按键名；单字符按键单独归一化为大写。 */
const NAMED_KEY_ALIASES: Record<string, string> = {
  space: 'Space',
  spacebar: 'Space',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  ins: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  arrowup: 'ArrowUp',
  up: 'ArrowUp',
  arrowdown: 'ArrowDown',
  down: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  left: 'ArrowLeft',
  arrowright: 'ArrowRight',
  right: 'ArrowRight',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '`': 'Backquote',
  '-': 'Minus',
  '=': 'Equal',
  '+': 'Plus'
}

function normalizeKeyName(part: string): string | null {
  const lower = part.toLowerCase()
  const named = NAMED_KEY_ALIASES[lower]
  if (named) return named
  if (/^[a-z0-9]$/.test(lower)) return lower.toUpperCase()
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower)) return lower.toUpperCase()
  return null
}

/**
 * 归一化快捷键字符串（C-10）。
 *
 * 录制侧采集到的是 DOM `event.key`（`Meta`/`Control`/`Option` 等），
 * 而 `@tauri-apps/plugin-global-shortcut` 只接受 `CommandOrControl`/`Ctrl`/`Alt`/`Shift`/`Super`。
 * 这里把别名统一成插件可接受的形式，同时校验「至少一个修饰键 + 恰好一个普通键」。
 *
 * @returns 归一化后的字符串；非法组合返回 `null`，调用方应提示用户。
 */
export function normalizeShortcut(shortcut: string): string | null {
  const raw = shortcut?.trim()
  if (!raw) return null

  const parts = raw
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return null

  const modifiers = new Set<ShortcutModifier>()
  let baseKey: string | null = null

  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()]
    if (modifier) {
      modifiers.add(modifier)
      continue
    }
    const key = normalizeKeyName(part)
    // 多个普通键或无法识别的按键都视为非法
    if (!key || baseKey) return null
    baseKey = key
  }

  if (!baseKey || modifiers.size === 0) return null

  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), baseKey].join('+')
}
