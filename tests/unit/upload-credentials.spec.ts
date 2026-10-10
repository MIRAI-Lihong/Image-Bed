import {describe, expect, it} from 'vitest'
import {createUploadCredentialsHandler} from '../../netlify/functions/lib/upload-credentials'
import {
  createMockStsProvider,
  MOCK_CREDENTIALS_TTL_MS,
  type StsProvider
} from '../../netlify/functions/lib/sts'

/** 一份完整的有效环境变量集合（值均为测试假值，不是真实密钥） */
const validEnv: Record<string, string> = {
  ALIBABA_CLOUD_ACCESS_KEY_ID: 'server-long-term-ak',
  ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'server-long-term-sk',
  OSS_REGION: 'oss-cn-hangzhou',
  OSS_BUCKET: 'test-bucket',
  OSS_UPLOAD_PREFIX: 'uploads/'
}

/** 固定基准时间，保证 mock 凭证过期时间可断言 */
const fixedNow = () => new Date('2026-10-10T00:00:00.000Z')

function makeHandler(
  envSource: Record<string, string | undefined>,
  provider?: StsProvider
) {
  return createUploadCredentialsHandler({
    envSource,
    stsProvider: provider ?? createMockStsProvider(fixedNow)
  })
}

function post(): Request {
  return new Request('https://example.net/api/upload-credentials', {
    method: 'POST'
  })
}

describe('POST /api/upload-credentials 契约', () => {
  it('成功响应返回完整授权契约字段', async () => {
    const handler = makeHandler(validEnv)
    const res = await handler(post())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      credentials: {
        accessKeyId: 'MOCK_STS_AK_ID',
        accessKeySecret: 'MOCK_STS_AK_SECRET',
        securityToken: 'MOCK_STS_SECURITY_TOKEN',
        expiration: new Date(
          fixedNow().getTime() + MOCK_CREDENTIALS_TTL_MS
        ).toISOString()
      },
      region: 'oss-cn-hangzhou',
      bucket: 'test-bucket',
      uploadPrefix: 'uploads/'
    })
  })

  it('临时凭证响应禁止缓存', async () => {
    const handler = makeHandler(validEnv)
    const res = await handler(post())

    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('环境变量缺失时返回 500 且错误码为 SERVER_ENV_MISSING', async () => {
    const source = {...validEnv}
    delete source.ALIBABA_CLOUD_ACCESS_KEY_SECRET

    const handler = makeHandler(source)
    const res = await handler(post())

    expect(res.status).toBe(500)
    const body = (await res.json()) as {error: string; message: string}
    expect(body.error).toBe('SERVER_ENV_MISSING')
    expect(body.message).toContain('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
  })

  it('响应不泄漏服务端长期密钥', async () => {
    const source = {...validEnv}
    delete source.OSS_BUCKET

    const res = await makeHandler(source)(post())
    const text = JSON.stringify(await res.json())

    expect(text).not.toContain('server-long-term-ak')
    expect(text).not.toContain('server-long-term-sk')
  })

  it('非 POST 方法返回 405', async () => {
    const handler = makeHandler(validEnv)
    const res = await handler(
      new Request('https://example.net/api/upload-credentials', {method: 'GET'})
    )

    expect(res.status).toBe(405)
    const body = (await res.json()) as {error: string}
    expect(body.error).toBe('METHOD_NOT_ALLOWED')
  })

  it('凭证签发失败时显式返回 500（不静默降级）', async () => {
    const failingProvider: StsProvider = {
      authorize: () => Promise.reject(new Error('STS 服务暂不可用'))
    }
    const handler = makeHandler(validEnv, failingProvider)

    const res = await handler(post())

    expect(res.status).toBe(500)
    const body = (await res.json()) as {error: string; message: string}
    expect(body.error).toBe('STS_AUTHORIZE_FAILED')
    expect(body.message).toContain('STS 服务暂不可用')
  })
})
