import { describe, expect, it } from 'vitest'
import type { UserItem } from '@/services/types'
import { extractAtUserIds, parseHtmlSafely } from '../mentionParser'

const makeUser = (uid: string, name: string, myName?: string): UserItem =>
  ({ uid, name, myName }) as unknown as UserItem

describe('parseHtmlSafely', () => {
  it('returns null for empty input', () => {
    expect(parseHtmlSafely('')).toBeNull()
  })

  it('parses a minimal document', () => {
    const doc = parseHtmlSafely('<p>hi</p>')
    expect(doc?.body.textContent).toBe('hi')
  })
})

describe('extractAtUserIds', () => {
  const users: UserItem[] = [
    makeUser('u1', 'Alice'),
    makeUser('u2', 'Bob', 'Bobby'),
    makeUser('u3', 'Charlie'),
    makeUser('u4', 'Alice') // duplicate display name to test ambiguity
  ]

  it('extracts uids from aitSpan nodes carrying data-ait-uid', () => {
    const html = '<p>Hi <span id="aitSpan" data-ait-uid="u1">@Alice</span> there</p>'
    expect(extractAtUserIds(html, users)).toEqual(['u1'])
  })

  it('resolves by myName (group alias) when uid is absent', () => {
    const html = '<p><span id="aitSpan">@Bobby</span></p>'
    expect(extractAtUserIds(html, users)).toEqual(['u2'])
  })

  it('drops ambiguous name matches silently', () => {
    const html = '<p><span id="aitSpan">@Alice</span></p>'
    // Two users named Alice (u1 and u4) — no unique resolution
    expect(extractAtUserIds(html, users)).toEqual([])
  })

  it('deduplicates repeated uids', () => {
    const html = '<p><span id="aitSpan" data-ait-uid="u1">@Alice</span> and <span data-ait-uid="u1">@Alice</span></p>'
    expect(extractAtUserIds(html, users)).toEqual(['u1'])
  })

  it('falls back to plain-text @name scan when no mention nodes are found', () => {
    const html = '<p>hey @Charlie check this</p>'
    expect(extractAtUserIds(html, users)).toEqual(['u3'])
  })

  it('skips unresolved plain-text @names', () => {
    const html = '<p>hey @Nobody</p>'
    expect(extractAtUserIds(html, users)).toEqual([])
  })

  it('returns empty array for html without any @ mentions', () => {
    expect(extractAtUserIds('<p>plain text</p>', users)).toEqual([])
  })

  it('prefers mention nodes over plain-text scan when both coexist', () => {
    const html = '<p><span id="aitSpan" data-ait-uid="u2">@Bobby</span> hi @Charlie</p>'
    // Once any mention node resolves, the plain-text fallback is skipped.
    expect(extractAtUserIds(html, users)).toEqual(['u2'])
  })
})
