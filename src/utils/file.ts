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

/** 剪贴板图片 MIME → 扩展名；未知类型回退 png */
const PASTE_MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** 剪贴板粘贴图片的统一命名：paste-yyyyMMdd-HHmmss.<ext>（取本地时间，便于识别） */
export function generatePasteFileName(mimeType: string, now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const ext = PASTE_MIME_TO_EXTENSION[mimeType] ?? 'png'
  return `paste-${date}-${time}.${ext}`
}

/**
 * 从剪贴板数据中提取图片文件。
 * 非图片内容（文本、文件管理器复制的文件等）静默忽略；
 * 剪贴板图片通常无文件名或重名（image.png），统一重命名后返回。
 */
export function extractPasteImages(clipboardData: DataTransfer | null, now?: Date): File[] {
  if (!clipboardData) return []
  const files: File[] = []
  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (!file) continue
    files.push(new File([file], generatePasteFileName(item.type, now), { type: file.type }))
  }
  return files
}
