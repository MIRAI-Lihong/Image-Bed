import { describe, expect, it } from 'vitest'

// 冒烟测试：仅验证 Vitest 基础设施可用，
// 业务逻辑测试将随后续功能任务补充。
describe('vitest 基础设施', () => {
  it('断言可以正常执行', () => {
    expect(1 + 1).toBe(2)
  })
})
