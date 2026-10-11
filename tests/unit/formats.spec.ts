import { describe, expect, it } from 'vitest'
import { formatDateTime, toHtml, toMarkdown } from '../../src/utils/formats'

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

describe('formatDateTime', () => {
  it('ISO 时间格式化为本地 yyyy-MM-dd HH:mm（无时区后缀按本地解析，测试结果与时区无关）', () => {
    expect(formatDateTime('2026-10-11T08:30:00')).toBe('2026-10-11 08:30')
  })

  it('无法解析时原样返回', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})
