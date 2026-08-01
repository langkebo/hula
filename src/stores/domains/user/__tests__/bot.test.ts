import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useBotStore } from '../bot'

describe('useBotStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with default values', () => {
    const store = useBotStore()
    expect(store.viewType).toBe('readme')
    expect(store.readmeLang).toBe('zh')
    expect(store.markdownSource).toBe('')
    expect(store.webUrl).toBe('')
    // assistantText is not exposed directly; verify via displayText
    expect(store.displayText).toBe('README (中文)')
  })

  describe('displayText', () => {
    it('returns "README (中文)" for zh readme view', () => {
      const store = useBotStore()
      expect(store.displayText).toBe('README (中文)')
    })

    it('returns "README (English)" for en readme view', () => {
      const store = useBotStore()
      store.setReadme('en')
      expect(store.displayText).toBe('README (English)')
    })

    it('returns "Markdown 文档" for empty markdown source', () => {
      const store = useBotStore()
      store.setMarkdown('')
      expect(store.displayText).toBe('Markdown 文档')
    })

    it('returns filename for markdown source with path', () => {
      const store = useBotStore()
      store.setMarkdown('docs%2Fguide.md')
      expect(store.displayText).toBe('guide.md')
    })

    it('returns original source when no slash in path', () => {
      const store = useBotStore()
      store.setMarkdown('readme.md')
      expect(store.displayText).toBe('readme.md')
    })

    it('returns "外部链接" for empty webUrl', () => {
      const store = useBotStore()
      store.setWeb('')
      expect(store.displayText).toBe('外部链接')
    })

    it('returns webUrl when set', () => {
      const store = useBotStore()
      store.setWeb('https://example.com')
      expect(store.displayText).toBe('https://example.com')
    })

    it('returns assistantText when set', () => {
      const store = useBotStore()
      store.setAssistant('Custom assistant text')
      expect(store.displayText).toBe('Custom assistant text')
    })

    it('returns default when assistantText is empty', () => {
      const store = useBotStore()
      store.setAssistant('')
      expect(store.displayText).toBe('正在预览模型')
    })

    it('returns default when assistantText is only whitespace', () => {
      const store = useBotStore()
      store.setAssistant('   ')
      expect(store.displayText).toBe('正在预览模型')
    })
  })

  describe('setReadme', () => {
    it('switches viewType to readme and sets lang', () => {
      const store = useBotStore()
      store.setWeb('https://x.com')
      store.setReadme('en')
      expect(store.viewType).toBe('readme')
      expect(store.readmeLang).toBe('en')
      expect(store.markdownSource).toBe('')
      expect(store.webUrl).toBe('')
    })

    it('clears markdownSource and webUrl when switching to readme', () => {
      const store = useBotStore()
      store.setMarkdown('doc.md')
      store.setWeb('https://y.com')
      store.setReadme('zh')
      expect(store.markdownSource).toBe('')
      expect(store.webUrl).toBe('')
    })
  })

  describe('setMarkdown', () => {
    it('decodes URI-encoded source', () => {
      const store = useBotStore()
      store.setMarkdown('path%2Fto%2Ffile.md')
      expect(store.markdownSource).toBe('path/to/file.md')
      expect(store.viewType).toBe('markdown')
      expect(store.webUrl).toBe('')
    })

    it('falls back to original source on invalid URI encoding', () => {
      const store = useBotStore()
      store.setMarkdown('%invalid%')
      expect(store.markdownSource).toBe('%invalid%')
    })

    it('accepts plain (non-encoded) source', () => {
      const store = useBotStore()
      store.setMarkdown('plain/path/file.md')
      expect(store.markdownSource).toBe('plain/path/file.md')
    })

    it('clears webUrl', () => {
      const store = useBotStore()
      store.setWeb('https://z.com')
      store.setMarkdown('doc.md')
      expect(store.webUrl).toBe('')
    })
  })

  describe('setWeb', () => {
    it('switches viewType to web and sets url', () => {
      const store = useBotStore()
      store.setWeb('https://example.com')
      expect(store.viewType).toBe('web')
      expect(store.webUrl).toBe('https://example.com')
    })
  })

  describe('setAssistant', () => {
    it('sets custom assistant text', () => {
      const store = useBotStore()
      store.setAssistant('My assistant')
      expect(store.viewType).toBe('assistant')
      expect(store.displayText).toBe('My assistant')
      expect(store.markdownSource).toBe('')
      expect(store.webUrl).toBe('')
    })

    it('uses default when text is undefined', () => {
      const store = useBotStore()
      store.setAssistant(undefined)
      expect(store.displayText).toBe('正在预览模型')
    })

    it('uses default when text is empty string', () => {
      const store = useBotStore()
      store.setAssistant('')
      expect(store.displayText).toBe('正在预览模型')
    })

    it('uses default when text is whitespace', () => {
      const store = useBotStore()
      store.setAssistant('\t\n ')
      expect(store.displayText).toBe('正在预览模型')
    })

    it('clears markdownSource and webUrl', () => {
      const store = useBotStore()
      store.setMarkdown('doc.md')
      store.setWeb('https://w.com')
      store.setAssistant('assistant')
      expect(store.markdownSource).toBe('')
      expect(store.webUrl).toBe('')
    })
  })

  describe('reset', () => {
    it('resets to default readme zh state', () => {
      const store = useBotStore()
      store.setMarkdown('doc.md')
      store.setAssistant('custom')
      store.reset()
      expect(store.viewType).toBe('readme')
      expect(store.readmeLang).toBe('zh')
      expect(store.markdownSource).toBe('')
      expect(store.webUrl).toBe('')
    })
  })
})
