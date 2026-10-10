import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadAuthorization } from '../../src/types/image'
import { createAliyunOssUploader } from '../../src/services/upload'

/**
 * mock ali-oss：记录客户端构造参数与 put 调用，
 * 上传结果由各用例自行设定。
 */
const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  clientOptions: [] as Array<Record<string, unknown>>,
}))

vi.mock('ali-oss', () => {
  class OSS {
    put = mocks.put
    constructor(options: Record<string, unknown>) {
      mocks.clientOptions.push(options)
    }
  }
  return { default: OSS }
})

/** 测试用授权数据（假凭证，非真实密钥） */
const auth: UploadAuthorization = {
  credentials: {
    accessKeyId: 'STS.mock-ak',
    accessKeySecret: 'STS.mock-sk',
    securityToken: 'STS.mock-token',
    expiration: '2026-10-10T00:15:00.000Z',
  },
  region: 'oss-cn-hangzhou',
  bucket: 'test-bucket',
  uploadPrefix: 'uploads/',
}

describe('createAliyunOssUploader', () => {
  beforeEach(() => {
    mocks.put.mockReset()
    mocks.clientOptions.length = 0
  })

  it('用临时凭证构造客户端并 put 到带前缀的对象 key', async () => {
    mocks.put.mockResolvedValue({ url: 'https://oss-result.example' })
    const file = new File(['fake-image'], 'photo.PNG', { type: 'image/png' })

    const result = await createAliyunOssUploader().upload(file, auth)

    // 客户端使用 STS 临时凭证（不含任何长期密钥），禁用 SDK 内置刷新
    expect(mocks.clientOptions).toHaveLength(1)
    expect(mocks.clientOptions[0]).toMatchObject({
      region: 'oss-cn-hangzhou',
      bucket: 'test-bucket',
      accessKeyId: 'STS.mock-ak',
      accessKeySecret: 'STS.mock-sk',
      stsToken: 'STS.mock-token',
      refreshSTSTokenInterval: 0,
    })

    // put 到 前缀/日期/唯一名 扩展名小写 的对象 key
    expect(mocks.put).toHaveBeenCalledTimes(1)
    const [objectKey, uploadedFile] = mocks.put.mock.calls[0]
    expect(uploadedFile).toBe(file)
    expect(objectKey).toMatch(/^uploads\/\d{4}\/\d{2}\/\d{2}\/[\w-]+\.png$/)

    // 返回结果携带对象 key 与公共读 URL
    expect(result).toEqual({
      name: 'photo.PNG',
      size: file.size,
      objectKey,
      url: `https://test-bucket.oss-cn-hangzhou.aliyuncs.com/${objectKey}`,
    })
  })

  it('上传失败时错误向上抛出（由组件展示失败状态）', async () => {
    mocks.put.mockRejectedValue(new Error('RequestError: oss timeout'))
    const file = new File(['fake-image'], 'cat.png', { type: 'image/png' })

    await expect(createAliyunOssUploader().upload(file, auth)).rejects.toThrow('oss timeout')
  })
})
