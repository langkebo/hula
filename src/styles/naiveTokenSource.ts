/**
 * Naive UI 主题色具体值（design-tokens.css 的 TS 镜像）。
 * Naive UI 内部用 seemely/rgba() 对颜色做运算（hover/pressed 派生），
 * 无法解析 CSS 变量引用，必须在 JS 侧持有具体色值；vitest 又会stub 掉
 * `.css?raw` 导入，故采用「TS 镜像 + 同步守护测试」：
 * design-tokens.css 仍是唯一权威源，镜像值由
 * `__tests__/naiveTokenSource.test.ts` 用 fs 读取 CSS 原文逐项断言一致，
 * 漂移即 CI 失败——禁止直接手改本文件色值。
 */

export type ThemeName = 'light' | 'dark'

type TokenMap = Record<string, string>

export interface NaiveThemeColors {
  primary500: string
  primary400: string
  primary600: string
  primary200: string
  primary100: string
  danger500: string
}

/** 亮色基准（值必须与 design-tokens.css :root 一致，由守护测试锁定） */
export const naiveLightColors: NaiveThemeColors = {
  primary500: '#13987f',
  primary400: '#1ab292',
  primary600: '#0f7a66',
  primary200: 'rgba(19, 152, 127, 0.2)',
  primary100: 'rgba(19, 152, 127, 0.1)',
  danger500: '#ff4d4f'
}

/** 暗色覆盖（值必须与 design-tokens.css 暗色块一致，未覆盖项继承亮色） */
export const naiveDarkColors: NaiveThemeColors = {
  ...naiveLightColors,
  primary200: 'rgba(19, 152, 127, 0.25)',
  primary100: 'rgba(19, 152, 127, 0.15)',
  danger500: '#ff7875'
}

export const naiveColorsFor = (theme: ThemeName): NaiveThemeColors =>
  theme === 'dark' ? naiveDarkColors : naiveLightColors

/** 从 #rrggbb 派生指定透明度的 rgba（Naive UI secondary hover/pressed 态需要具体值） */
export const withAlpha = (hex: string, alpha: number): string => {
  const match = hex.match(/^#([0-9a-fA-F]{6})$/)
  if (!match) throw new Error(`withAlpha 仅支持 #rrggbb 输入: ${hex}`)
  const value = Number.parseInt(match[1], 16)
  return `rgba(${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff}, ${alpha})`
}

export interface ParsedDesignTokens {
  light: TokenMap
  dark: TokenMap
}

interface CssFrame {
  selector: string
  body: string
}

/** 逐字符扫描 CSS，收集各选择器链下的 --token 声明（供同步守护测试使用） */
export const parseDesignTokens = (cssText: string): ParsedDesignTokens => {
  const light: TokenMap = {}
  const dark: TokenMap = {}
  const stack: CssFrame[] = []
  let selectorBuf = ''

  const applyDeclarations = (frame: CssFrame, parents: CssFrame[]) => {
    const chain = [...parents.map((f) => f.selector), frame.selector].join(' ')
    // 暗色块选择器形如 html[data-theme='dark']；其余 :root 块视为亮色基准
    const target = /\[data-theme/.test(chain) ? dark : /:root/.test(chain) ? light : null
    if (!target) return
    for (const match of frame.body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+?);/g)) {
      target[match[1]] = match[2].trim()
    }
  }

  for (const ch of cssText) {
    if (ch === '{') {
      stack.push({ selector: selectorBuf.trim(), body: '' })
      selectorBuf = ''
      continue
    }
    if (ch === '}') {
      const frame = stack.pop()
      if (frame) applyDeclarations(frame, stack)
      selectorBuf = ''
      continue
    }
    if (stack.length > 0) {
      stack[stack.length - 1].body += ch
    } else {
      selectorBuf += ch
    }
  }
  return { light, dark }
}

/** 在解析结果中解析 token：暗色覆盖优先、缺失回落 :root、沿 var() 链解引用 */
export const resolveParsedToken = (parsed: ParsedDesignTokens, name: string, theme: ThemeName): string => {
  const token = name.startsWith('--') ? name : `--${name}`
  const seen = new Set<string>()
  const resolve = (current: string): string => {
    if (seen.has(current)) throw new Error(`design-tokens.css token 循环引用: ${current}`)
    seen.add(current)
    const raw = (theme === 'dark' ? parsed.dark[current] : undefined) ?? parsed.light[current]
    if (raw === undefined) throw new Error(`design-tokens.css 中未定义 token: ${current}`)
    const ref = raw.match(/var\(\s*(--[\w-]+)/)
    return ref ? resolve(ref[1]) : raw
  }
  return resolve(token)
}
