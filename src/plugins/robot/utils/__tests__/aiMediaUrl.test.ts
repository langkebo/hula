import { describe, it, expect } from 'vitest'
import { getAiMediaExtension } from '../aiMediaUrl'

describe('getAiMediaExtension', () => {
  it('returns the extension from a plain URL', () => {
    expect(getAiMediaExtension('https://cdn.example.com/x.png')).toBe('png')
    expect(getAiMediaExtension('https://cdn.example.com/clip.webm')).toBe('webm')
  })

  it('strips query string before parsing', () => {
    expect(getAiMediaExtension('https://x.com/a.jpg?token=abc&t=1')).toBe('jpg')
  })

  it('strips fragment before parsing', () => {
    expect(getAiMediaExtension('https://x.com/a.mp4#frag')).toBe('mp4')
  })

  it('returns fallback when there is no extension', () => {
    expect(getAiMediaExtension('https://cdn.example.com/noext')).toBe('png')
    expect(getAiMediaExtension('https://cdn.example.com/noext', 'jpg')).toBe('jpg')
  })

  it('rejects implausibly long candidates as extensions', () => {
    expect(getAiMediaExtension('https://x.com/a.something-long')).toBe('png')
  })

  it('rejects path-like segments that contain a slash', () => {
    expect(getAiMediaExtension('https://x.com/a.b/c', 'mp3')).toBe('mp3')
  })

  it('returns fallback for empty URL', () => {
    expect(getAiMediaExtension('', 'wav')).toBe('wav')
  })
})
