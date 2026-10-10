/** 链接格式化：生成 Markdown / HTML 引用 */

export function toMarkdown(url: string, alt: string): string {
  return `![${alt}](${url})`
}

export function toHtml(url: string, alt: string): string {
  return `<img src="${url}" alt="${alt}">`
}
