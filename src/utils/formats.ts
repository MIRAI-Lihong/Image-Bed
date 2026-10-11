/** 链接格式化：生成 Markdown / HTML 引用 */

export function toMarkdown(url: string, alt: string): string {
  return `![${alt}](${url})`
}

export function toHtml(url: string, alt: string): string {
  return `<img src="${url}" alt="${alt}">`
}

/** 历史记录时间展示：ISO 8601 → 本地时间 yyyy-MM-dd HH:mm；无法解析时原样返回 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number): string => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
