/** 允许上传的图片扩展名（svg 可被内联执行脚本，不开放） */
const ALLOWED_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
])

/** 提取小写扩展名；无有效扩展名时返回空字符串 */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

/**
 * 校验图片文件；返回错误信息，通过校验时返回 undefined。
 * 双重校验：MIME 以 image/ 开头 + 扩展名在白名单内。
 */
export function validateImageFile(file: {
  name: string
  type: string
}): string | undefined {
  if (!file.type.startsWith('image/')) {
    return '不支持的文件类型：仅支持 PNG、JPG、GIF、WebP 图片'
  }
  if (!ALLOWED_IMAGE_EXTENSIONS.has(fileExtension(file.name))) {
    return '不支持的图片格式：仅支持 PNG、JPG、GIF、WebP'
  }
  return undefined
}

/** 人类可读的文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
