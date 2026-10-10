/**
 * STS 临时凭证接口定义与实现。
 *
 * 上传授权流程（见 doc/architecture/upload-authorization.md）：
 *   前端 POST /api/upload-credentials
 *     -> 本服务端读取 ServerEnv（长期密钥只在服务端）
 *     -> StsProvider 用长期密钥换取 STS 临时凭证
 *     -> 返回 临时凭证 + 上传目标信息（region/bucket/prefix）
 *   前端使用临时凭证直接上传 OSS，凭证过期后重新申请。
 */

import StsClientPkg, { AssumeRoleRequest } from '@alicloud/sts20150401'
import { Config as OpenApiConfig } from '@alicloud/openapi-client'
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

/** 临时凭证有效期（秒）：控制在 15 分钟内（AGENTS.md 安全规范） */
export const STS_CREDENTIALS_DURATION_SECONDS = 900

/** AssumeRole 会话名，用于云端审计日志识别来源 */
const STS_ROLE_SESSION_NAME = 'image-bed-upload'

/**
 * 解析 STS Client 构造函数。
 *
 * Tea SDK 的 CJS 产物没有 __esModule 标记：纯 Node ESM（本地 tsx）与
 * Netlify 的 esbuild 打包都会把 default import 解析成 exports 对象
 * （真正的构造函数在其 .default 属性上），部分打包器则直接给出构造函数。
 * 这里统一按两种形态解析，保证各运行时行为一致。
 */
export function resolveStsClientCtor(pkg: unknown): typeof StsClientPkg {
  if (typeof pkg === 'function') return pkg as typeof StsClientPkg
  const inner = (pkg as { default?: unknown }).default
  if (typeof inner === 'function') return inner as typeof StsClientPkg
  throw new Error('无法从 @alicloud/sts20150401 解析 Client 构造函数')
}

const Sts20150401 = resolveStsClientCtor(StsClientPkg)

/**
 * 阿里云 STS 实现：使用服务端长期密钥 AssumeRole 换取受限临时凭证。
 * 角色本身的权限策略负责限定 Bucket、前缀与 oss:PutObject 动作。
 */
export function createAliyunStsProvider(): StsProvider {
  return {
    async authorize(env: ServerEnv): Promise<UploadAuthorization> {
      // OSS 地域 oss-cn-hangzhou -> STS endpoint sts.cn-hangzhou.aliyuncs.com
      const stsEndpoint = `sts.${env.region.replace(/^oss-/, '')}.aliyuncs.com`
      const client = new Sts20150401(
        new OpenApiConfig({
          accessKeyId: env.accessKeyId,
          accessKeySecret: env.accessKeySecret,
          endpoint: stsEndpoint,
        }),
      )

      const request = new AssumeRoleRequest({
        roleArn: env.stsRoleArn,
        roleSessionName: STS_ROLE_SESSION_NAME,
        durationSeconds: STS_CREDENTIALS_DURATION_SECONDS,
      })

      const response = await client.assumeRole(request)
      const credentials = response.body?.credentials
      if (
        !credentials?.accessKeyId ||
        !credentials.accessKeySecret ||
        !credentials.securityToken ||
        !credentials.expiration
      ) {
        throw new Error('STS 未返回完整凭证')
      }

      return {
        credentials: {
          accessKeyId: credentials.accessKeyId,
          accessKeySecret: credentials.accessKeySecret,
          securityToken: credentials.securityToken,
          expiration: credentials.expiration,
        },
        region: env.region,
        bucket: env.bucket,
        uploadPrefix: env.uploadPrefix,
      }
    },
  }
}

/**
 * STS 提供者工厂：生产环境使用阿里云 STS。
 * mock 实现保留给测试与本地无凭证联调使用。
 */
export function createStsProvider(): StsProvider {
  return createAliyunStsProvider()
}
