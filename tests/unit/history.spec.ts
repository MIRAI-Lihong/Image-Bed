import { describe, expect, it } from 'vitest'
import {
  appendHistoryItem,
  createHistoryStore,
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  parseHistory,
  serializeHistory,
  type HistoryItem,
  type NewHistoryItem,
} from '../../src/services/history'

function makeItem(overrides: Partial<NewHistoryItem> = {}): NewHistoryItem {
  return {
    url: 'https://test-bucket.oss-cn-hangzhou.aliyuncs.com/uploads/2026/10/11/uuid.png',
    objectKey: 'uploads/2026/10/11/uuid.png',
    fileName: 'cat.png',
    size: 102400,
    uploadedAt: '2026-10-11T08:30:00.000Z',
    ...overrides,
  }
}

/** 内存版 Storage：行为与浏览器 localStorage 一致 */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  }
}

/** 读写都会抛错的 Storage：模拟隐私模式/用户禁用 */
function createThrowingStorage(): Storage {
  const denied = (): never => {
    throw new Error('Storage access denied')
  }
  return {
    getItem: denied,
    setItem: denied,
    removeItem: denied,
    clear: denied,
    key: denied,
    get length() {
      return 0
    },
  }
}

describe('parseHistory', () => {
  it('null 返回空数组', () => {
    expect(parseHistory(null)).toEqual([])
  })

  it('JSON 损坏时返回空数组，不抛错', () => {
    expect(parseHistory('{broken json')).toEqual([])
  })

  it('版本不符时返回空数组', () => {
    expect(parseHistory(JSON.stringify({ version: 999, items: [makeItem()] }))).toEqual([])
  })

  it('逐条过滤字段缺失的损坏记录', () => {
    const valid = { ...makeItem(), id: 'ok-1' }
    const raw = JSON.stringify({
      version: 1,
      items: [valid, { id: 'bad-1' }, 'not-an-object', null],
    })
    expect(parseHistory(raw)).toEqual([valid])
  })
})

describe('serializeHistory / parseHistory', () => {
  it('往返一致', () => {
    const items: HistoryItem[] = [
      { ...makeItem(), id: 'id-1' },
      { ...makeItem({ fileName: 'dog.png' }), id: 'id-2' },
    ]
    expect(parseHistory(serializeHistory(items))).toEqual(items)
  })
})

describe('appendHistoryItem', () => {
  it('新记录追加到最前', () => {
    const older: HistoryItem = { ...makeItem(), id: 'old' }
    const next = appendHistoryItem([older], makeItem({ fileName: 'new.png' }), 'new')
    expect(next.map((i) => i.id)).toEqual(['new', 'old'])
  })

  it('超出上限时从末尾淘汰最旧记录', () => {
    const full: HistoryItem[] = Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
      ...makeItem(),
      id: `id-${i}`,
    }))
    const next = appendHistoryItem(full, makeItem(), 'fresh')
    expect(next).toHaveLength(HISTORY_LIMIT)
    expect(next[0]?.id).toBe('fresh')
    expect(next.at(-1)?.id).toBe(`id-${HISTORY_LIMIT - 2}`)
  })
})

describe('createHistoryStore', () => {
  it('add / list / remove 完整闭环', () => {
    const store = createHistoryStore(createMemoryStorage())
    const afterAdd = store.add(makeItem())
    expect(afterAdd).toHaveLength(1)
    expect(store.list()).toEqual(afterAdd)

    const afterRemove = store.remove(afterAdd[0]!.id)
    expect(afterRemove).toEqual([])
    expect(store.list()).toEqual([])
  })

  it('写入持久化：新实例能读到旧实例写入的数据', () => {
    const storage = createMemoryStorage()
    const first = createHistoryStore(storage)
    const added = first.add(makeItem())

    const second = createHistoryStore(storage)
    expect(second.list()).toEqual(added)
  })

  it('使用约定的 storage key 与版本化结构', () => {
    const storage = createMemoryStorage()
    createHistoryStore(storage).add(makeItem())
    const raw = storage.getItem(HISTORY_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).version).toBe(1)
  })

  it('storage 读写抛错时静默降级：不抛错且会话内可用', () => {
    const store = createHistoryStore(createThrowingStorage())
    const added = store.add(makeItem())
    expect(added).toHaveLength(1)
    expect(store.list()).toEqual(added)
    expect(() => store.remove(added[0]!.id)).not.toThrow()
  })

  it('不传 storage 时退化为仅内存', () => {
    const store = createHistoryStore()
    expect(store.list()).toEqual([])
    store.add(makeItem())
    expect(store.list()).toHaveLength(1)
  })
})
