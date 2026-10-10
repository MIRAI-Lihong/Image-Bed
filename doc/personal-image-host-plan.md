# 个人图床工具开发方案

## 一、项目目标

开发一个供个人使用的轻量级图床工具，通过网页上传图片，将图片存储在阿里云 OSS，并生成可复制的图片链接，方便在博客、GitHub README、Markdown 笔记等场景中使用。

整体方案：

- **GitHub**：托管源码、版本管理。
- **Netlify**：部署前端，并提供轻量级服务端函数。
- **阿里云 OSS**：存储上传的图片。
- **Netlify Functions + 阿里云 STS**：安全地为前端签发临时上传凭证。

该方案无需自行购买和维护传统服务器，适合个人项目起步。

## 二、整体架构

```text
用户浏览器
    |
    | 1. 请求上传授权
    v
Netlify Functions
    |
    | 2. 使用服务端密钥获取 STS 临时凭证
    v
阿里云 STS
    |
    | 3. 返回临时凭证
    v
Netlify Functions
    |
    | 4. 将临时凭证返回前端
    v
用户浏览器
    |
    | 5. 携带临时凭证，直接上传图片
    v
阿里云 OSS
    |
    | 6. 返回图片地址
    v
用户浏览器：预览图片、复制链接、保存历史记录
```

代码与部署流程：

```text
本地开发 -> GitHub 仓库 -> Netlify 自动构建和部署
```

GitHub 和 Netlify 负责应用代码与部署；OSS 负责保存图片。重新部署前端通常不会影响已经存储在 OSS 中的图片。

## 三、技术选型

| 模块 | 推荐方案 | 主要作用 |
|---|---|---|
| 前端框架 | Vue 3 + TypeScript + Vite | 构建图床网页 |
| UI 组件库 | Element Plus | 上传、弹窗、图片列表等界面 |
| 图片存储 | 阿里云 OSS | 保存原始图片 |
| 上传授权 | Netlify Functions + 阿里云 STS | 安全地签发临时上传凭证 |
| 代码管理 | GitHub | 源码托管与版本管理 |
| 部署 | Netlify | 托管前端并提供 Functions |
| 本地历史记录 | localStorage 或 IndexedDB | 保存最近上传的图片记录 |

第一版可以暂时不接入数据库。上传成功后，将图片地址、文件名、上传时间等信息保存在浏览器本地。

注意：本地历史记录只属于当前浏览器。清理浏览器数据或更换设备后，记录可能丢失，但 OSS 中的图片不会因此自动删除。

## 四、核心功能规划

### 4.1 第一阶段：基础图床

- [ ] 点击选择图片上传
- [ ] 支持拖拽上传
- [ ] 支持多张图片批量上传
- [ ] 展示图片预览
- [ ] 展示上传进度、失败状态
- [ ] 支持失败重试
- [ ] 上传成功后显示图片 URL
- [ ] 一键复制图片 URL
- [ ] 一键复制 Markdown 格式
- [ ] 一键复制 HTML 格式
- [ ] 上传成功后可自动复制链接

建议支持以下复制格式：

**原始 URL**

```text
https://your-bucket.oss-cn-hangzhou.aliyuncs.com/images/example.png
```

**Markdown**

```markdown
![图片描述](图片地址)
```

**HTML**

```html
<img src="图片地址" alt="图片描述">
```

**Markdown 链接**

```markdown
[查看图片](图片地址)
```

### 4.2 第二阶段：图片管理

- [ ] 查看历史上传记录
- [ ] 搜索和筛选图片
- [ ] 删除 OSS 中的图片
- [ ] 自定义文件名
- [ ] 自动生成唯一文件名，避免重名覆盖
- [ ] 按日期或用途分类存储
- [ ] 展示图片尺寸、文件大小和上传时间
- [ ] 批量复制图片链接

### 4.3 第三阶段：开发者体验

- [ ] 支持批量生成 Markdown、HTML 等格式
- [ ] 图片压缩
- [ ] 可选的 WebP 转换
- [ ] 批量上传和批量复制
- [ ] 暗色模式
- [ ] 快捷键操作
- [ ] 粘贴剪贴板中的图片并上传

## 五、关键技术与安全注意事项

### 5.1 不要将长期 AccessKey 暴露在前端

这是项目中最重要的安全要求。

前端代码会被浏览器下载，用户可以通过开发者工具查看。因此，不要把阿里云长期 `AccessKey ID` 和 `AccessKey Secret` 写进 Vue 代码中。即使写在前端项目的 `.env` 文件中，经过构建后也不能保证密钥安全。

推荐流程：

1. 前端向 Netlify Functions 请求上传授权。
2. Functions 从 Netlify 环境变量读取服务端密钥。
3. Functions 使用服务端凭证向阿里云 STS 获取临时凭证。
4. 前端拿到临时凭证后，在权限范围内直接上传到 OSS。
5. 临时凭证过期后，前端重新申请。

应遵循最小权限原则，尽可能限制临时凭证的有效期、允许操作的 Bucket、对象路径和操作类型。服务端密钥也应使用权限受限的 RAM 身份，不要使用权限过大的主账号凭证。

### 5.2 设计 OSS 图片访问权限

需要提前确定图片是公开访问还是私有访问。

- **公开图床**：图片可通过固定 URL 访问，适合博客、README 和 Markdown 内容。
- **私有图床**：Bucket 保持私有，通过签名 URL 等方式授权访问；签名 URL 通常会过期，不适合作为永久图片链接。

如果选择公开访问，应只公开确实需要分享的图片，并避免上传包含隐私或敏感信息的内容。还应确认 Bucket 的读写权限配置正确，避免无关用户获得上传或删除权限。

### 5.3 配置 OSS CORS

网页部署在 Netlify，而图片存储在阿里云 OSS。浏览器从网页直接向 OSS 发起上传请求时，需要检查 OSS Bucket 的跨域资源共享（CORS）配置。

根据实际上传方式，配置：

- 允许的来源（Origin），优先填写自己的 Netlify 域名和本地开发地址。
- 允许的 HTTP 方法。
- 允许的请求头。
- 必要时配置暴露给浏览器读取的响应头。

不要为了省事就无条件开放所有来源和请求头；应根据项目的实际需求配置，并通过浏览器开发者工具检查跨域错误。

### 5.4 图片地址与自定义域名

上传成功后，OSS 可以提供类似这样的地址：

```text
https://your-bucket.oss-cn-hangzhou.aliyuncs.com/images/example.png
```

后续可以考虑配置自己的图片域名，让链接更简洁、更稳定。配置前需要确认域名、HTTPS 证书、DNS 和 OSS 相关设置，并了解可能产生的费用。

### 5.5 Netlify 的职责边界

Netlify 负责托管前端和运行轻量级授权函数，不建议把图片文件先上传到 Netlify Functions，再由函数转存到 OSS。

推荐让浏览器获得受限的临时凭证后，直接将图片上传到 OSS，减少文件中转、服务端流量和函数处理压力。

同时，需要确认 Netlify Functions 的使用限制、部署可用性，以及实际网络环境下 Netlify 和 OSS 的访问速度。

## 六、建议的项目目录

以下是一个可参考的初始目录，后续可按实际实现调整：

```text
personal-image-host/
├── netlify/
│   └── functions/
│       └── get-upload-credentials.ts
├── public/
├── src/
│   ├── components/
│   │   ├── ImageUploader.vue
│   │   ├── ImagePreview.vue
│   │   └── ImageHistory.vue
│   ├── services/
│   │   └── oss.ts
│   ├── types/
│   │   └── image.ts
│   ├── utils/
│   │   ├── clipboard.ts
│   │   └── file.ts
│   ├── App.vue
│   └── main.ts
├── .env.example
├── .gitignore
├── netlify.toml
├── package.json
├── tsconfig.json
└── vite.config.ts
```

注意：`.env.example` 只能存放变量名称和示例值，不要提交真实密钥。真实服务端密钥应配置在 Netlify 的环境变量中；本地开发时使用未纳入版本控制的本地环境文件。

## 七、建议的开发顺序

### 第一步：准备基础设施

1. 创建阿里云 OSS Bucket。
2. 确认 Bucket 所在地域、访问权限和图片访问方式。
3. 配置用于签发上传授权的 RAM 身份和最小权限策略。
4. 准备 STS 临时凭证方案。
5. 创建 GitHub 仓库。
6. 创建 Vue 3 + TypeScript + Vite 项目。
7. 将仓库连接到 Netlify。

### 第二步：完成最小可用版本

1. 实现选择图片和拖拽上传界面。
2. 实现 Netlify Functions 上传授权接口。
3. 配置 OSS CORS。
4. 实现前端通过临时凭证直传 OSS。
5. 上传成功后展示图片预览和访问 URL。
6. 实现复制 URL、Markdown 和 HTML。
7. 使用浏览器开发者工具验证上传请求与错误处理。

### 第三步：补充图片管理

1. 将上传记录保存到 localStorage 或 IndexedDB。
2. 展示历史图片。
3. 增加搜索、筛选和批量复制。
4. 如果需要删除图片，增加受鉴权保护的服务端删除接口，不要让前端获得任意删除 OSS 对象的权限。

### 第四步：测试与上线

- [ ] 测试常见图片格式
- [ ] 测试单张和批量上传
- [ ] 测试大文件、网络中断和上传失败
- [ ] 测试临时凭证过期后的处理
- [ ] 测试 OSS CORS 配置
- [ ] 检查前端构建产物中没有长期密钥
- [ ] 检查 OSS 权限和上传路径限制
- [ ] 测试图片 URL 在博客、GitHub README 等场景中的访问效果
- [ ] 确认 OSS 存储、请求和流量费用

## 八、后续扩展方向

如果未来需要跨设备同步历史、管理图片元数据或开放给其他人使用，可以继续增加：

- 数据库：保存图片元数据和用户信息。
- 登录鉴权：限制只有授权用户才能上传、查看或删除图片。
- 上传限额：限制文件大小、文件类型、单次数量和每日上传量。
- 滥用防护：防止公开接口被滥用，控制成本。
- 图片处理：缩略图、压缩、格式转换。
- 自定义域名：使用更简洁的图片访问地址。

如果只供个人使用，第一版不必急于接入数据库或构建复杂的账号系统，但仍应保护上传授权接口和云端密钥。

## 九、最终推荐方案

第一版建议采用：

- **前端**：Vue 3 + TypeScript + Vite
- **UI**：Element Plus
- **存储**：阿里云 OSS
- **授权**：Netlify Functions + 阿里云 STS
- **代码托管**：GitHub
- **部署**：Netlify
- **上传历史**：localStorage 或 IndexedDB
- **图片访问**：根据用途选择公开访问或私有签名 URL

核心原则：**图片直接上传 OSS，长期密钥只保存在服务端，前端只使用权限受限的临时凭证。**

## 十、官方参考资料

- [阿里云 OSS：客户端直传](https://help.aliyun.com/zh/oss/user-guide/uploading-objects-to-oss-directly-from-clients/)
- [阿里云 OSS：授权访问](https://help.aliyun.com/zh/oss/developer-reference/authorize-access-6)
- [Netlify Functions 文档](https://docs.netlify.com/build/functions/overview/)
- [Netlify Edge Functions 文档](https://docs.netlify.com/build/edge-functions/overview/)
