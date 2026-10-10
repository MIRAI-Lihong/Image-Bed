/**
 * 上传授权 handler 核心（不含环境读取，便于测试注入）。
 *
 * HTTP 契约：
 *   POST /api/upload-credentials
 *     200 -> UploadAuthorization JSON（Cache-Control: no-store）
 *     405 -> 非POST方法
 *     500 -> { error: 'SERVER_ENV_MISSING', message } 环境变量缺失（显式失败）
 *     500 -> { error: 'STS_AUTHORIZE_FAILED', message } 凭证签发失败
 */

import { loadServerEnv, MissingEnvError } from './env'
import type { StsProvider } from './sts'

/** Netlify Functions v2 风格 handler：标准 Web Request/Response */
export type UploadCredentialsHandler = (request: Request) => Promise<Response>

/** handler 依赖：环境变量来源与 STS 提供者均由调用方注入 */
export interface UploadCredentialsHandlerOptions {
  envSource: Record<string, string | undefined>
  stsProvider: StsProvider
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function createUploadCredentialsHandler(
  options: UploadCredentialsHandlerOptions,
): UploadCredentialsHandler {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED', message: '仅支持 POST' })
    }

    let serverEnv
    try {
      serverEnv = loadServerEnv(options.envSource)
    } catch (error) {
      if (error instanceof MissingEnvError) {
        // 环境变量缺失：显式失败，不静默降级；message 只含变量名，不含值
        return jsonResponse(500, { error: 'SERVER_ENV_MISSING', message: error.message })
      }
      throw error
    }

    try {
      const authorization = await options.stsProvider.authorize(serverEnv)
      // 临时凭证不可被缓存：响应始终 no-store
      return jsonResponse(200, authorization)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return jsonResponse(500, { error: 'STS_AUTHORIZE_FAILED', message })
    }
  }
}
