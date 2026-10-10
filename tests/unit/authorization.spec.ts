import { describe, expect, it, vi } from 'vitest'
import { createAuthorizationClient } from '../../src/services/authorization'
import type { UploadAuthorization } from '../../src/types/image'

function makeAuth(expiresInMs: number): UploadAuthorization {
  return {
    credentials: {
      accessKeyId: 'MOCK_STS_AK_ID',
      accessKeySecret: 'MOCK_STS_AK_SECRET',
      securityToken: 'MOCK_STS_SECURITY_TOKEN',
      expiration: new Date(Date.now() + expiresInMs).toISOString(),
    },
    region: 'oss-cn-hangzhou',
    bucket: 'test-bucket',
    uploadPrefix: 'uploads/',
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createAuthorizationClient', () => {
  it('成功获取并解析授权响应', async () => {
    const auth = makeAuth(10 * 60_000)
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(auth))
    const client = createAuthorizationClient(fetchFn)

    await expect(client.getAuthorization()).resolves.toEqual(auth)
    expect(fetchFn).toHaveBeenCalledWith('/api/upload-credentials', { method: 'POST' })
  })

  it('凭证有效期内复用缓存，不重复请求', async () => {
    const auth = makeAuth(10 * 60_000)
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(auth))
    const client = createAuthorizationClient(fetchFn)

    await client.getAuthorization()
    await client.getAuthorization()

    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('凭证临近过期（60 秒内）时重新请求', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makeAuth(30_000)))
      .mockResolvedValueOnce(jsonResponse(makeAuth(10 * 60_000)))
    const client = createAuthorizationClient(fetchFn)

    await client.getAuthorization()
    await client.getAuthorization()

    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('非 2xx 响应抛出包含服务端 message 的错误', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ error: 'SERVER_ENV_MISSING', message: '服务端环境变量缺失：OSS_BUCKET' }, 500),
    )
    const client = createAuthorizationClient(fetchFn)

    await expect(client.getAuthorization()).rejects.toThrow('OSS_BUCKET')
  })

  it('错误响应体不可解析时使用默认错误消息', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }))
    const client = createAuthorizationClient(fetchFn)

    await expect(client.getAuthorization()).rejects.toThrow('HTTP 502')
  })
})
