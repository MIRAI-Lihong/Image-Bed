/**
 * STS 临时凭证接口定义。
 *
 * 上传授权流程（见 doc/architecture/upload-authorization.md）：
 *   前端 POST /api/upload-credentials
 *     -> 本服务端读取 ServerEnv（长期密钥只在服务端）
 *     -> StsProvider 用长期密钥换取 STS 临时凭证
 *     -> 返回 临时凭证 + 上传目标信息（region/bucket/prefix）
 *   前端使用临时凭证直接上传 OSS，凭证过期后重新申请。
 *
 * 当前阶段使用 mock 实现，真实 STS AssumeRole 接入点见 createStsProvider。
 */

import type { ServerEnv } from './env'

/** STS 临时凭证（对前端可见，短时有效，权限受限） */
export interface StsCredentials {
  readonly accessKeyId: string
  readonly accessKeySecret: string
  readonly securityToken: string
  /** 过期时间，ISO 8601 格式 */
  readonly expiration: string
}

/** 随临时凭证下发的上传目标信息，前端据此构造 OSS 客户端与对象 key */
export interface UploadAuthorization {
  readonly credentials: StsCredentials
  readonly region: string
  readonly bucket: string
  readonly uploadPrefix: string
}

/** STS 凭证提供者：负责用服务端长期密钥换取受限临时凭证 */
export interface StsProvider {
  authorize(env: ServerEnv): Promise<UploadAuthorization>
}

/** mock 临时凭证有效期（毫秒）：与真实实现一致，控制在 15 分钟内 */
export const MOCK_CREDENTIALS_TTL_MS = 15 * 60 * 1000

/**
 * mock 实现：返回确定性假凭证，用于契约测试与前端联调。
 * 假凭证不具备真实 OSS 访问能力。
 */
export function createMockStsProvider(now: () => Date = () => new Date()): StsProvider {
  return {
    async authorize(env: ServerEnv): Promise<UploadAuthorization> {
      return {
        credentials: {
          accessKeyId: 'MOCK_STS_AK_ID',
          accessKeySecret: 'MOCK_STS_AK_SECRET',
          securityToken: 'MOCK_STS_SECURITY_TOKEN',
          expiration: new Date(now().getTime() + MOCK_CREDENTIALS_TTL_MS).toISOString(),
        },
        region: env.region,
        bucket: env.bucket,
        uploadPrefix: env.uploadPrefix,
      }
    },
  }
}

/**
 * STS 提供者工厂。
 *
 * 当前返回 mock 实现；接入真实阿里云 STS 时，在此处基于
 * ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET 创建 AssumeRole 客户端，
 * 策略限定到 env.bucket + env.uploadPrefix 的 oss:PutObject，
 * 有效期不超过 15 分钟。
 */
export function createStsProvider(): StsProvider {
  return createMockStsProvider()
}
