/**
 * 上传授权客户端。
 *
 * 调用 POST /api/upload-credentials 获取 STS 临时凭证，
 * 凭证有效期内复用缓存，临近过期（60 秒内）自动重新申请。
 */

import type { UploadAuthorization } from '../types/image'

const AUTH_ENDPOINT = '/api/upload-credentials'

/** 过期提前量：避免上传途中凭证失效 */
const EXPIRY_MARGIN_MS = 60_000

export interface AuthorizationClient {
  getAuthorization(): Promise<UploadAuthorization>
}

/** 用可控的 fetch 实现创建客户端（默认使用全局 fetch），便于测试 */
export function createAuthorizationClient(fetchFn: typeof fetch = fetch): AuthorizationClient {
  let cached: UploadAuthorization | null = null

  return {
    async getAuthorization(): Promise<UploadAuthorization> {
      if (
        cached !== null &&
        Date.now() < Date.parse(cached.credentials.expiration) - EXPIRY_MARGIN_MS
      ) {
        return cached
      }

      const response = await fetchFn(AUTH_ENDPOINT, { method: 'POST' })
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response))
      }
      cached = (await response.json()) as UploadAuthorization
      return cached
    },
  }
}

/** 从错误响应中提取服务端 message；响应体不可解析时退回默认消息 */
async function extractErrorMessage(response: Response): Promise<string> {
  let detail = ''
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body.message === 'string') detail = body.message
  } catch {
    // 响应体不是 JSON：使用默认消息
  }
  return detail
    ? `获取上传授权失败：${detail}`
    : `获取上传授权失败（HTTP ${response.status}）`
}

/** 应用级单例：组件直接使用 */
export const authorizationClient = createAuthorizationClient()
