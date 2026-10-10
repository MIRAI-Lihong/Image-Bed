import { describe, expect, it } from 'vitest'
import { fileExtension, formatFileSize, validateImageFile } from '../../src/utils/file'

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
