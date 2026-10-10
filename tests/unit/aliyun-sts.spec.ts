import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerEnv } from '../../netlify/functions/lib/env'
import {
  createAliyunStsProvider,
  resolveStsClientCtor,
  STS_CREDENTIALS_DURATION_SECONDS,
} from '../../netlify/functions/lib/sts'

/**
 * mock 阿里云 STS SDK：记录客户端构造参数与 AssumeRole 请求，
 * 凭证返回值由各用例自行设定（值均为测试假值，不是真实密钥）。
 */
const mocks = vi.hoisted(() => ({
  assumeRole: vi.fn(),
  clientConfigs: [] as Array<{
    accessKeyId?: string
    accessKeySecret?: string
    endpoint?: string
  }>,
}))

vi.mock('@alicloud/sts20150401', () => {
  class Sts20150401 {
    assumeRole = mocks.assumeRole
    constructor(config: {
      accessKeyId?: string
      accessKeySecret?: string
      endpoint?: string
    }) {
      mocks.clientConfigs.push(config)
    }
  }
  class AssumeRoleRequest {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  }
  return { default: Sts20150401, AssumeRoleRequest }
})

/** 一份完整的服务端配置（值均为测试假值） */
const validEnv: ServerEnv = {
  accessKeyId: 'server-long-term-ak',
  accessKeySecret: 'server-long-term-sk',
  region: 'oss-cn-hangzhou',
  bucket: 'test-bucket',
  uploadPrefix: 'uploads/',
  stsRoleArn: 'acs:ram::1234567890:role/test-role',
}

/** STS 假返回凭证 */
const stsCredentials = {
  accessKeyId: 'STS.mock-ak',
  accessKeySecret: 'STS.mock-sk',
  securityToken: 'STS.mock-token',
  expiration: '2026-10-10T00:15:00.000Z',
}

describe('resolveStsClientCtor', () => {
  it('构造函数直达形态（部分打包器的 interop）', () => {
    const ctor = class MockClient {}
    expect(resolveStsClientCtor(ctor)).toBe(ctor)
  })

  it('exports 对象形态（纯 Node ESM / esbuild）：构造函数在 .default 上', () => {
    const ctor = class MockClient {}
    expect(resolveStsClientCtor({ default: ctor })).toBe(ctor)
  })

  it('两种形态都不是时抛错', () => {
    expect(() => resolveStsClientCtor({})).toThrow(
      '无法从 @alicloud/sts20150401 解析 Client 构造函数',
    )
    expect(() => resolveStsClientCtor({ default: 'not-a-ctor' })).toThrow()
  })
})

describe('createAliyunStsProvider', () => {
  beforeEach(() => {
    mocks.assumeRole.mockReset()
    mocks.clientConfigs.length = 0
  })

  it('凭证有效期不超过 15 分钟（AGENTS.md 安全规范）', () => {
    expect(STS_CREDENTIALS_DURATION_SECONDS).toBeLessThanOrEqual(900)
  })

  it('用长期密钥向 region 对应 STS endpoint 发起 AssumeRole 并映射凭证', async () => {
    mocks.assumeRole.mockResolvedValue({ body: { credentials: stsCredentials } })

    const auth = await createAliyunStsProvider().authorize(validEnv)

    // 客户端使用服务端长期密钥，endpoint 由 OSS region 转换而来
    expect(mocks.clientConfigs).toHaveLength(1)
    expect(mocks.clientConfigs[0]).toMatchObject({
      accessKeyId: 'server-long-term-ak',
      accessKeySecret: 'server-long-term-sk',
      endpoint: 'sts.cn-hangzhou.aliyuncs.com',
    })

    // AssumeRole 请求限定目标角色与有效期
    const request = mocks.assumeRole.mock.calls[0][0] as { input: Record<string, unknown> }
    expect(request.input).toMatchObject({
      roleArn: 'acs:ram::1234567890:role/test-role',
      durationSeconds: STS_CREDENTIALS_DURATION_SECONDS,
    })
    expect(typeof request.input.roleSessionName).toBe('string')

    // 返回完整授权契约
    expect(auth).toEqual({
      credentials: stsCredentials,
      region: 'oss-cn-hangzhou',
      bucket: 'test-bucket',
      uploadPrefix: 'uploads/',
    })
  })

  it('STS 返回凭证不完整时抛错，不下发残缺凭证', async () => {
    mocks.assumeRole.mockResolvedValue({
      body: { credentials: { accessKeyId: 'only-ak' } },
    })

    await expect(createAliyunStsProvider().authorize(validEnv)).rejects.toThrow(
      'STS 未返回完整凭证',
    )
  })

  it('AssumeRole 调用失败时错误向上抛出（由 handler 转为 500）', async () => {
    mocks.assumeRole.mockRejectedValue(new Error('InvalidAccessKeyId.NotFound'))

    await expect(createAliyunStsProvider().authorize(validEnv)).rejects.toThrow(
      'InvalidAccessKeyId.NotFound',
    )
  })
})
