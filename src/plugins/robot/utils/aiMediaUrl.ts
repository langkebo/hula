export const isLikelyImageUrl = (value?: string): boolean => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    /^https?:\/\//.test(value) ||
    lower.startsWith('data:image/') ||
    lower.startsWith('asset:') ||
    lower.startsWith('file:') ||
    lower.startsWith('tauri://') ||
    lower.startsWith('blob:')
  )
}

export const isLikelyMediaUrl = (value?: string): boolean => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    /^https?:\/\//.test(value) ||
    lower.startsWith('data:') ||
    lower.startsWith('asset:') ||
    lower.startsWith('file:') ||
    lower.startsWith('tauri://') ||
    lower.startsWith('blob:')
  )
}

/**
 * Extract a file extension from a remote AI-generated media URL.
 *
 * - Strips query / fragment before inspection.
 * - Rejects overlong (>5 chars) or path-like candidates that are almost
 *   certainly not a real extension.
 * - Returns `fallback` when no valid extension can be recovered.
 */
export function getAiMediaExtension(url: string, fallback = 'png'): string {
  const cleanUrl = url.split(/[?#]/)[0] || ''
  const ext = cleanUrl.split('.').pop() || ''
  if (!ext || ext.length > 5 || ext.includes('/')) return fallback
  return ext
}
