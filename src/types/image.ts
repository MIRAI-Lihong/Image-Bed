/**
 * 图片上传相关类型。
 * UploadAuthorization 与服务端契约对齐（doc/architecture/upload-authorization.md）。
 */

/** 上传授权响应：STS 临时凭证 + 上传目标信息 */
export interface UploadAuthorization {
  readonly credentials: {
    readonly accessKeyId: string
    readonly accessKeySecret: string
    readonly securityToken: string
    /** 过期时间，ISO 8601 格式 */
    readonly expiration: string
  }
  readonly region: string
  readonly bucket: string
  readonly uploadPrefix: string
}

/** 单个文件的上传状态 */
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'

/** 上传成功结果 */
export interface UploadResult {
  /** OSS 对象 key，例如 uploads/2026/10/10/uuid.png */
  readonly objectKey: string
  /** 可公开访问的图片 URL */
  readonly url: string
}

/** 上传列表项（组件内状态） */
export interface UploadItem {
  readonly id: string
  /** 原始 File 对象（组件内以 markRaw 持有，避免被深度代理） */
  readonly file: File
  readonly fileName: string
  readonly fileSize: number
  /** 本地预览地址（objectURL），校验失败的文件没有预览 */
  readonly previewUrl: string
  status: UploadStatus
  error?: string
  result: UploadResult | null
}
