/**
 * 上传历史记录：localStorage 本地持久化（选型与结构见 doc/adr/0002-upload-history-local-storage.md）。
 *
 * 存储结构：{ version: 1, items: HistoryItem[] }，新记录在前，上限 100 条。
 * 异常降级：localStorage 不可用（隐私模式、配额满）或数据损坏时不抛错，
 * 退化为内存态空历史，上传功能不受影响。
 */

/** 单条历史记录（上传成功后写入） */
export interface HistoryItem {
  readonly id: string
  /** 可公开访问的图片 URL */
  readonly url: string
  /** OSS 对象 key，例如 uploads/2026/10/11/uuid.png */
  readonly objectKey: string
  readonly fileName: string
  /** 文件大小（字节） */
  readonly size: number
  /** 上传时间，ISO 8601 格式 */
  readonly uploadedAt: string
}

/** 写入时由调用方提供的字段；id 由存储层生成 */
export type NewHistoryItem = Omit<HistoryItem, 'id'>

export const HISTORY_STORAGE_KEY = 'image-bed:history'
/** 历史上限：超出后从末尾淘汰最旧记录（ADR 0002） */
export const HISTORY_LIMIT = 100

/** 存储结构版本：未来结构变更时用于迁移判断 */
const HISTORY_VERSION = 1

interface HistoryFile {
  version: number
  items: unknown[]
}

/** 序列化历史记录（纯函数） */
export function serializeHistory(items: readonly HistoryItem[]): string {
  return JSON.stringify({ version: HISTORY_VERSION, items })
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.url === 'string' &&
    typeof item.objectKey === 'string' &&
    typeof item.fileName === 'string' &&
    typeof item.size === 'number' &&
    typeof item.uploadedAt === 'string'
  )
}

/**
 * 反序列化历史记录（纯函数）。
 * null、JSON 损坏、版本不符时返回空数组；逐条过滤掉字段缺失的损坏记录。
 */
export function parseHistory(raw: string | null): HistoryItem[] {
  if (raw === null) return []
  let parsed: HistoryFile
  try {
    parsed = JSON.parse(raw) as HistoryFile
  } catch {
    return []
  }
  if (parsed.version !== HISTORY_VERSION || !Array.isArray(parsed.items)) return []
  return parsed.items.filter(isHistoryItem)
}

/** 追加记录（纯函数）：新记录在前，超出上限从末尾淘汰最旧 */
export function appendHistoryItem(
  items: readonly HistoryItem[],
  item: NewHistoryItem,
  id: string,
  limit: number = HISTORY_LIMIT,
): HistoryItem[] {
  return [{ ...item, id }, ...items].slice(0, limit)
}

/** 历史记录读写接口 */
export interface HistoryStore {
  list(): HistoryItem[]
  /** 追加一条记录，返回最新列表 */
  add(item: NewHistoryItem): HistoryItem[]
  /** 移除指定记录（仅删本地数据，不动 OSS 对象），返回最新列表 */
  remove(id: string): HistoryItem[]
}

function generateHistoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** localStorage 被禁用等情况：读取失败视为空历史 */
function safeRead(storage: Storage): string | null {
  try {
    return storage.getItem(HISTORY_STORAGE_KEY)
  } catch {
    return null
  }
}

/** 隐私模式 / 配额满：放弃持久化，内存态仍然更新 */
function safeWrite(storage: Storage, value: string): void {
  try {
    storage.setItem(HISTORY_STORAGE_KEY, value)
  } catch {
    // 静默降级
  }
}

/**
 * 创建历史记录存储。storage 缺省或不可用时退化为仅内存：
 * 本次会话内历史可用，刷新后丢失。
 */
export function createHistoryStore(storage?: Storage): HistoryStore {
  // 内存缓存：避免重复解析；storage 不可用时兜底维持会话内可用
  let cached: HistoryItem[] | null = null

  function readAll(): HistoryItem[] {
    if (cached === null) {
      cached = storage ? parseHistory(safeRead(storage)) : []
    }
    return cached
  }

  function writeAll(items: HistoryItem[]): void {
    cached = items
    if (storage) safeWrite(storage, serializeHistory(items))
  }

  return {
    list: () => readAll(),
    add(item) {
      const next = appendHistoryItem(readAll(), item, generateHistoryId())
      writeAll(next)
      return next
    },
    remove(id) {
      const next = readAll().filter((item) => item.id !== id)
      writeAll(next)
      return next
    },
  }
}

/** 应用级单例：浏览器环境使用 localStorage；非浏览器环境自动降级为内存态 */
export const historyStore = createHistoryStore(
  typeof localStorage === 'undefined' ? undefined : localStorage,
)
