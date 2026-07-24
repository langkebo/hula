import { describe, expect, it } from 'vitest'
import { highlightSearchMatch } from '../highlightSearchMatch'

describe('highlightSearchMatch', () => {
  it('将匹配前缀部分标记为 matched', () => {
    expect(highlightSearchMatch('Alice', 'Ali')).toEqual([
      { text: 'Ali', matched: true },
      { text: 'ce', matched: false }
    ])
  })

  it('大小写不敏感匹配，保留原始大小写', () => {
    expect(highlightSearchMatch('Alice', 'ali')).toEqual([
      { text: 'Ali', matched: true },
      { text: 'ce', matched: false }
    ])
  })

  it('空查询时返回整段文本为非匹配', () => {
    expect(highlightSearchMatch('Alice', '')).toEqual([{ text: 'Alice', matched: false }])
  })

  it('无匹配时返回整段文本为非匹配', () => {
    expect(highlightSearchMatch('Alice', 'xyz')).toEqual([{ text: 'Alice', matched: false }])
  })

  it('匹配在文本中间时正确分段', () => {
    expect(highlightSearchMatch('@alice:example.com', 'alice')).toEqual([
      { text: '@', matched: false },
      { text: 'alice', matched: true },
      { text: ':example.com', matched: false }
    ])
  })
})
