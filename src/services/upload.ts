/**
 * 上传服务：对象 key 生成、公共 URL 构造、上传器。
 *
 * 当前使用 mock 上传器打通链路；接入真实 OSS 时在
 * createImageUploader 中替换为基于 STS 临时凭证的直传实现。
 */

import type { UploadAuthorization } from '../types/image'
import { fileExtension } from '../utils/file'

/** 规范化上传前缀：不以 / 开头，以 / 结尾 */
export function normalizeUploadPrefix(prefix: string): string {
  const trimmed = prefix.trim()
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

/**
 * 生成 OSS 对象 key：{prefix}{yyyy}/{MM}/{dd}/{uniqueId}.{ext}
 * 日期取本地时间，便于按上传日期归类。
 */
export function buildObjectKey(
  prefix: string,
  fileName: string,
  uniqueId: string,
  now: Date = new Date(),
): string {
  const ext = fileExtension(fileName) || 'png'
  const yyyy = String(now.getFullYear()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${normalizeUploadPrefix(prefix)}${yyyy}/${mm}/${dd}/${uniqueId}.${ext}`
}

/** 构造公共读 Bucket 的可访问 URL（虚拟主机风格） */
export function buildPublicUrl(region: string, bucket: string, objectKey: string): string {
  return `https://${bucket}.${region}.aliyuncs.com/${objectKey}`
}

/** 上传结果（独立于组件状态） */
export interface UploadedImage {
  readonly name: string
  readonly size: number
  readonly objectKey: string
  readonly url: string
}

/** 图片上传器：用授权信息把文件上传到 OSS */
export interface ImageUploader {
  upload(file: File, auth: UploadAuthorization): Promise<UploadedImage>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** mock 上传器：不上传任何数据，仅生成对象 key 并返回 URL，用于链路联调 */
export function createMockImageUploader(delayMs = 500): ImageUploader {
  return {
    async upload(file: File, auth: UploadAuthorization): Promise<UploadedImage> {
      await sleep(delayMs)
      const objectKey = buildObjectKey(auth.uploadPrefix, file.name, generateUniqueId())
      return {
        name: file.name,
        size: file.size,
        objectKey,
        url: buildPublicUrl(auth.region, auth.bucket, objectKey),
      }
    },
  }
}

/**
 * 上传器工厂。
 *
 * 当前返回 mock 实现；接入真实 OSS 时在此处创建基于
 * auth.credentials 临时凭证的直传客户端（如 ali-oss）。
 */
export function createImageUploader(): ImageUploader {
  return createMockImageUploader()
}
