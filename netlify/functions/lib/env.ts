/**
 * 服务端环境变量读取与校验。
 *
 * 仅允许 Netlify Functions 使用；前端禁止读取任何服务端变量。
 * 变量缺失时显式抛错，不做静默降级（见 AGENTS.md 安全规范）。
 */

/** 阿里云长期密钥与 OSS 配置，由 Netlify 环境变量提供 */
export interface ServerEnv {
  /** 阿里云 RAM 身份 AccessKey ID（长期密钥，仅服务端可用） */
  readonly accessKeyId: string
  /** 阿里云 RAM 身份 AccessKey Secret（长期密钥，仅服务端可用） */
  readonly accessKeySecret: string
  /** OSS 地域，例如 oss-cn-hangzhou */
  readonly region: string
  /** OSS Bucket 名称 */
  readonly bucket: string
  /** 上传对象强制前缀，例如 uploads/ */
  readonly uploadPrefix: string
}

/** 环境变量缺失错误：message 只包含变量名，绝不包含任何变量值 */
export class MissingEnvError extends Error {
  constructor(missingNames: string[]) {
    super(
      `服务端环境变量缺失：${missingNames.join('、')}。` +
        `请在 Netlify 环境变量或本地 .env 中配置后重试（参见 .env.example）。`,
    )
    this.name = 'MissingEnvError'
  }
}

/** 变量名到 ServerEnv 字段的映射，集中管理避免散落的字符串 */
const ENV_KEYS = {
  accessKeyId: 'ALIBABA_CLOUD_ACCESS_KEY_ID',
  accessKeySecret: 'ALIBABA_CLOUD_ACCESS_KEY_SECRET',
  region: 'OSS_REGION',
  bucket: 'OSS_BUCKET',
  uploadPrefix: 'OSS_UPLOAD_PREFIX',
} as const satisfies Record<keyof ServerEnv, string>

/** 空字符串或纯空白视为未配置 */
function readValue(source: Record<string, string | undefined>, name: string): string | undefined {
  const raw = source[name]
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * 从给定环境变量集合读取并校验服务端配置。
 *
 * @param source 环境变量集合，调用方传入（如 Netlify Function 中的 process.env）
 * @throws MissingEnvError 存在缺失变量时抛出，错误信息列出全部缺失变量名
 */
export function loadServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const resolved: Partial<Record<keyof ServerEnv, string>> = {}
  const missingNames: string[] = []

  for (const [field, envName] of Object.entries(ENV_KEYS) as [keyof ServerEnv, string][]) {
    const value = readValue(source, envName)
    if (value === undefined) {
      missingNames.push(envName)
    } else {
      resolved[field] = value
    }
  }

  if (missingNames.length > 0) {
    throw new MissingEnvError(missingNames)
  }

  return resolved as ServerEnv
}
