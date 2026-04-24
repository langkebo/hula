export interface TokenEstimable {
  content?: string
  reasoningContent?: string
}

/**
 * Rough client-side token counter used to display a token-usage hint before
 * the backend returns its authoritative count.
 *
 * ASCII text: ~4 chars per token. Non-ASCII (CJK etc.): 1 char per token.
 * Meant for budgeting UX, not billing — off by a constant factor from real
 * tokenizers.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0
  const chars = Array.from(text)
  const asciiChars = chars.filter((ch) => (ch.codePointAt(0) as number) <= 0x7f)
  const ascii = asciiChars.join('')
  const nonAsciiCount = chars.length - asciiChars.length
  const asciiWords = ascii.trim().split(/\s+/).filter(Boolean)
  const asciiTokens = asciiWords.reduce((acc, w) => acc + Math.ceil(w.length / 4), 0)
  return asciiTokens + nonAsciiCount
}

export function estimateMessageTokens(message: TokenEstimable): number {
  return estimateTokens(message.content) + estimateTokens(message.reasoningContent)
}
