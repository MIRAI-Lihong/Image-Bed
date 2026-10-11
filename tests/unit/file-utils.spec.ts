import { describe, expect, it } from 'vitest'
import {
  extractPasteImages,
  fileExtension,
  formatFileSize,
  generatePasteFileName,
  validateImageFile,
} from '../../src/utils/file'

describe('fileExtension', () => {
  it('提取小写扩展名', () => {
    expect(fileExtension('photo.PNG')).toBe('png')
    expect(fileExtension('avatar.jpeg')).toBe('jpeg')
  })

  it('无扩展名或隐藏文件返回空字符串', () => {
    expect(fileExtension('README')).toBe('')
    expect(fileExtension('.gitignore')).toBe('')
  })
})

describe('validateImageFile', () => {
  it('接受白名单内的位图格式', () => {
    expect(validateImageFile({ name: 'a.png', type: 'image/png' })).toBeUndefined()
    expect(validateImageFile({ name: 'b.JPG', type: 'image/jpeg' })).toBeUndefined()
    expect(validateImageFile({ name: 'c.webp', type: 'image/webp' })).toBeUndefined()
  })

  it('拒绝非 image MIME 的文件', () => {
    expect(validateImageFile({ name: 'a.png', type: 'application/octet-stream' })).toContain(
      '不支持的文件类型',
    )
    expect(validateImageFile({ name: 'a.png', type: '' })).toContain('不支持的文件类型')
  })

  it('拒绝扩展名不在白名单的文件（含 svg）', () => {
    expect(validateImageFile({ name: 'icon.svg', type: 'image/svg+xml' })).toContain(
      '不支持的图片格式',
    )
    expect(validateImageFile({ name: 'virus.png.exe', type: 'image/png' })).toContain(
      '不支持的图片格式',
    )
  })
})

describe('formatFileSize', () => {
  it('按数量级展示单位', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('generatePasteFileName', () => {
  it('按 MIME 生成 paste-yyyyMMdd-HHmmss 格式文件名（本地时间，与时区无关）', () => {
    const now = new Date(2026, 9, 11, 8, 5, 3) // 本地 2026-10-11 08:05:03
    expect(generatePasteFileName('image/png', now)).toBe('paste-20261011-080503.png')
    expect(generatePasteFileName('image/jpeg', now)).toBe('paste-20261011-080503.jpg')
    expect(generatePasteFileName('image/webp', now)).toBe('paste-20261011-080503.webp')
  })

  it('未知 MIME 回退 png 扩展名', () => {
    expect(generatePasteFileName('image/bmp', new Date(2026, 0, 2, 3, 4, 5))).toBe(
      'paste-20260102-030405.png',
    )
  })
})

describe('extractPasteImages', () => {
  function fakeClipboard(
    items: Array<{ kind: string; type: string; file?: File | null }>,
  ): DataTransfer {
    return {
      items: items.map(({ kind, type, file }) => ({
        kind,
        type,
        getAsFile: () => file ?? null,
      })),
    } as unknown as DataTransfer
  }

  it('提取图片项并按粘贴规则重命名', () => {
    const now = new Date(2026, 9, 11, 8, 5, 3)
    const data = fakeClipboard([
      { kind: 'file', type: 'image/png', file: new File(['x'], 'image.png', { type: 'image/png' }) },
    ])
    const files = extractPasteImages(data, now)
    expect(files).toHaveLength(1)
    expect(files[0]?.name).toBe('paste-20261011-080503.png')
    expect(files[0]?.type).toBe('image/png')
  })

  it('非图片内容与字符串项静默忽略', () => {
    const data = fakeClipboard([
      { kind: 'string', type: 'text/plain' },
      { kind: 'file', type: 'application/pdf', file: new File(['x'], 'a.pdf') },
      { kind: 'file', type: 'image/png', file: null }, // getAsFile 失败
    ])
    expect(extractPasteImages(data)).toEqual([])
  })

  it('clipboardData 为 null 时返回空数组', () => {
    expect(extractPasteImages(null)).toEqual([])
  })
})
