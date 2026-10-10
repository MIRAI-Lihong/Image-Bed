/**
 * Netlify Function 入口：POST /api/upload-credentials
 *
 * 为前端签发 OSS 上传所需的 STS 临时凭证与上传目标信息。
 * 依赖注入集中在入口完成，核心逻辑见 lib/upload-credentials.ts。
 */

import { createUploadCredentialsHandler } from './lib/upload-credentials'
import { createStsProvider } from './lib/sts'

export default createUploadCredentialsHandler({
  envSource: process.env,
  stsProvider: createStsProvider(),
})

export const config = { path: '/api/upload-credentials' }
