export type HighlightSegment = {
  text: string
  matched: boolean
}

export function highlightSearchMatch(text: string, query: string): HighlightSegment[] {
  if (!query) {
    return [{ text, matched: false }]
  }

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) {
    return [{ text, matched: false }]
  }

  const segments: HighlightSegment[] = []
  if (index > 0) {
    segments.push({ text: text.slice(0, index), matched: false })
  }
  segments.push({ text: text.slice(index, index + query.length), matched: true })
  const after = text.slice(index + query.length)
  if (after) {
    segments.push({ text: after, matched: false })
  }

  return segments
}
