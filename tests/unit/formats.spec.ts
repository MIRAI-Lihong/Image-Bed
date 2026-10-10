import { describe, expect, it } from 'vitest'
import { toHtml, toMarkdown } from '../../src/utils/formats'

describe('toMarkdown', () => {
  it('生成 Markdown 图片语法', () => {
    expect(toMarkdown('https://example.com/a.png', '示例图')).toBe(
      '![示例图](https://example.com/a.png)',
    )
  })
})

describe('toHtml', () => {
  it('生成 HTML img 标签', () => {
    expect(toHtml('https://example.com/a.png', '示例图')).toBe(
      '<img src="https://example.com/a.png" alt="示例图">',
    )
  })
})
