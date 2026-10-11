# 任务清单

## 已完成

- [x] 任务 1：仓库与脚手架基线
  - 初始化 Git、Vue 3 + TS + Vite
  - 建立目录结构和基础脚本
- [x] 任务 2：规则与文档基线
  - 固化 `AGENTS.md`
  - 补架构说明、验收标准、运行手册骨架
- [x] 任务 3：质量门禁基线
  - 接入 TypeScript、ESLint、Vitest、构建脚本
  - 提供 `validate` 统一校验入口
- [x] 任务 4：配置与密钥边界
  - `.env.example`
  - 前后端变量命名约束
  - 环境变量校验与错误提示
- [x] 任务 5：服务端授权骨架
  - Netlify Function 结构
  - STS 获取流程接口定义
  - 先用 mock 或契约测试打通
- [x] 任务 6：前端上传 MVP 骨架
  - 选择图片、预览、复制 URL / Markdown
  - 先接 mock 授权，再接真实 OSS（已切换真实 STS + ali-oss 直传并通过 Netlify 生产验证）
  - UI 优化：拖放上传区、状态反馈动画

## V1 收尾（均已完成）

### 任务 7：上传历史记录（localStorage）

存储选型与数据结构见 [ADR 0002](../adr/0002-upload-history-local-storage.md)。

范围：

- 新增 `src/services/history.ts`：历史记录的读写封装（纯函数 + 注入 Storage，沿用项目 DI 风格）
- 上传成功后追加一条记录：`id / url / objectKey / fileName / size / uploadedAt`
- 上限 100 条，超出淘汰最旧；读取时 JSON 解析失败降级为空历史，不阻塞上传
- 新增历史记录 UI 区块：缩略图（直接用公共读 URL）、文件名、大小、时间、复制 URL / Markdown / HTML、单条移除（仅移除本地记录，不删 OSS 对象）

验收标准：

- 上传成功后记录持久化，刷新页面仍可见
- 满 100 条后最旧记录被淘汰
- localStorage 不可用（如隐私模式）时上传功能不受影响
- 移除记录只影响本地，OSS 图片仍可访问
- 存储模块有对应单元测试，`npm run validate` 全绿

### 任务 8：剪贴板粘贴上传

范围：

- 在 `ImageUploader.vue` 监听全局 `paste` 事件，从 `event.clipboardData.items` 中过滤 `image/*` 项转为 File
- 剪贴板图片通常无文件名，统一生成 `paste-yyyyMMdd-HHmmss.<ext>` 格式的友好文件名
- 粘贴得到的 File 复用现有 `addFiles` 链路（校验 → 预览 → 上传 → 复制），不另起路径
- dropzone 提示文案补充"支持 Ctrl+V 粘贴"
- 页面失焦时不响应；非图片剪贴板内容静默忽略，不报错

验收标准：

- 截图后 Ctrl+V 可直接上传并返回链接
- 复制文本后 Ctrl+V 不产生任何反应
- 粘贴文件与拖放/点选文件走完全相同的上传链路
- 文件名提取逻辑有对应单元测试，`npm run validate` 全绿
