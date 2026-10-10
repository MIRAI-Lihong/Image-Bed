# 上传授权接口契约

前端上传前调用本接口获取 STS 临时凭证与上传目标信息，随后直传 OSS。
实现位于 `netlify/functions/get-upload-credentials.ts`。

## 请求

```text
POST /api/upload-credentials
```

无请求体。前端与函数同域部署（Netlify），无需 CORS。

## 成功响应（200）

```json
{
  "credentials": {
    "accessKeyId": "STS.xxxx",
    "accessKeySecret": "xxxx",
    "securityToken": "xxxx",
    "expiration": "2026-10-10T00:15:00.000Z"
  },
  "region": "oss-cn-hangzhou",
  "bucket": "example-bucket",
  "uploadPrefix": "uploads/"
}
```

- `credentials`：STs 临时凭证，有效期不超过 15 分钟，过期后前端需重新申请
- `region` / `bucket` / `uploadPrefix`：上传目标信息，前端据此构造 OSS 客户端并拼接对象 key
- 响应头固定 `Cache-Control: no-store`，临时凭证禁止被任何层缓存

## 失败响应

| 状态码 | error | 说明 |
|---|---|---|
| 405 | `METHOD_NOT_ALLOWED` | 非 POST 方法 |
| 500 | `SERVER_ENV_MISSING` | 服务端环境变量缺失（message 只含变量名，不含值） |
| 500 | `STS_AUTHORIZE_FAILED` | 凭证签发失败（如 STS 服务异常） |

服务端环境变量缺失时显式报错，不允许静默降级（见 AGENTS.md）。

## 安全边界

- 长期密钥只存在于 Netlify 环境变量，仅在服务端使用，不出现在任何响应中
- 临时凭证权限限定到指定 Bucket + `uploadPrefix` 前缀的 `oss:PutObject`，无删除权限
- 当前阶段 `StsProvider` 为 mock 实现（`netlify/functions/lib/sts.ts`），
  真实阿里云 STS AssumeRole 接入点在 `createStsProvider()` 工厂中替换
