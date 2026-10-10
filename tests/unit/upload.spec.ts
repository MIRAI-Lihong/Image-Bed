import { describe, expect, it } from 'vitest'
import type { UploadAuthorization } from '../../src/types/image'
import {
  buildObjectKey,
  buildPublicUrl,
  createMockImageUploader,
  normalizeUploadPrefix,
} from '../../src/services/upload'

/** 测试用授权数据（mock 凭证，非真实密钥） */
const mockAuth: UploadAuthorization = {
  credentials: {
    accessKeyId: 'MOCK_STS_AK_ID',
    accessKeySecret: 'MOCK_STS_AK_SECRET',
    securityToken: 'MOCK_STS_SECURITY_TOKEN',
    expiration: '2026-10-10T00:15:00.000Z',
  },
  region: 'oss-cn-hangzhou',
  bucket: 'test-bucket',
  uploadPrefix: 'uploads/',
}

describe('normalizeUploadPrefix', () => {
  it('补齐尾部斜杠', () => {
    expect(normalizeUploadPrefix('uploads')).toBe('uploads/')
  })

  it('已有尾部斜杠保持不变', () => {
    expect(normalizeUploadPrefix('uploads/')).toBe('uploads/')
  })
})

describe('buildObjectKey', () => {
  const now = new Date(2026, 9, 10, 8, 30, 0)

  it('按 前缀/日期/唯一名.扩展名 生成', () => {
    expect(buildObjectKey('uploads/', 'photo.PNG', 'abc-123', now)).toBe(
      'uploads/2026/10/10/abc-123.png',
    )
  })

  it('无扩展名时默认 png', () => {
    expect(buildObjectKey('uploads', 'README', 'abc', now)).toBe('uploads/2026/10/10/abc.png')
  })

  it('不同唯一名生成不同 key', () => {
    const a = buildObjectKey('uploads/', 'a.png', 'id-1', now)
    const b = buildObjectKey('uploads/', 'a.png', 'id-2', now)
    expect(a).not.toBe(b)
  })
})

describe('buildPublicUrl', () => {
  it('构造虚拟主机风格 URL', () => {
    expect(buildPublicUrl('oss-cn-hangzhou', 'my-bucket', 'uploads/a.png')).toBe(
      'https://my-bucket.oss-cn-hangzhou.aliyuncs.com/uploads/a.png',
    )
  })
})

describe('createMockImageUploader', () => {
  it('返回带对象 key 与公共 URL 的上传结果', async () => {
    const uploader = createMockImageUploader(0)
    const file = new File(['fake-image'], 'cat.png', { type: 'image/png' })

    const result = await uploader.upload(file, mockAuth)

    expect(result.name).toBe('cat.png')
    expect(result.size).toBe(file.size)
    expect(result.objectKey).toMatch(/^uploads\/\d{4}\/\d{2}\/\d{2}\/[\w-]+\.png$/)
    expect(result.url).toBe(`https://test-bucket.oss-cn-hangzhou.aliyuncs.com/${result.objectKey}`)
  })

  it('同一文件两次上传生成不同对象 key（避免重名覆盖）', async () => {
    const uploader = createMockImageUploader(0)
    const file = new File(['fake-image'], 'cat.png', { type: 'image/png' })

    const first = await uploader.upload(file, mockAuth)
    const second = await uploader.upload(file, mockAuth)

    expect(first.objectKey).not.toBe(second.objectKey)
  })
})
