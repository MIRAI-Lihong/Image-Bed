import { describe, expect, it } from 'vitest'
import { loadServerEnv, MissingEnvError } from '../../netlify/functions/lib/env'

/** 一份完整的有效环境变量集合（值均为测试假值，不是真实密钥） */
const validSource: Record<string, string> = {
  ALIBABA_CLOUD_ACCESS_KEY_ID: 'test-ak-id',
  ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'test-ak-secret',
  OSS_REGION: 'oss-cn-hangzhou',
  OSS_BUCKET: 'test-bucket',
  OSS_UPLOAD_PREFIX: 'uploads/',
  ALIBABA_CLOUD_STS_ROLE_ARN: 'acs:ram::1234567890:role/test-role',
}

describe('loadServerEnv', () => {
  it('全部变量配置正确时返回完整服务端配置', () => {
    const env = loadServerEnv(validSource)

    expect(env).toEqual({
      accessKeyId: 'test-ak-id',
      accessKeySecret: 'test-ak-secret',
      region: 'oss-cn-hangzhou',
      bucket: 'test-bucket',
      uploadPrefix: 'uploads/',
      stsRoleArn: 'acs:ram::1234567890:role/test-role',
    })
  })

  it('变量值两侧空白会被裁剪', () => {
    const env = loadServerEnv({
      ...validSource,
      OSS_BUCKET: '  test-bucket  ',
    })

    expect(env.bucket).toBe('test-bucket')
  })

  it('单个变量缺失时抛出 MissingEnvError 并指明变量名', () => {
    const source = { ...validSource }
    delete source.OSS_BUCKET

    expect(() => loadServerEnv(source)).toThrow(MissingEnvError)
    expect(() => loadServerEnv(source)).toThrow(/OSS_BUCKET/)
  })

  it('多个变量缺失时错误信息列出全部缺失变量名', () => {
    const source = {
      OSS_REGION: 'oss-cn-hangzhou',
    }

    try {
      loadServerEnv(source)
      expect.unreachable('应当抛出 MissingEnvError')
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError)
      const message = (error as Error).message
      expect(message).toContain('ALIBABA_CLOUD_ACCESS_KEY_ID')
      expect(message).toContain('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
      expect(message).toContain('OSS_BUCKET')
      expect(message).toContain('OSS_UPLOAD_PREFIX')
    }
  })

  it('空字符串和纯空白视为缺失', () => {
    const source = {
      ...validSource,
      OSS_REGION: '',
      OSS_BUCKET: '   ',
    }

    expect(() => loadServerEnv(source)).toThrow(/OSS_REGION/)
    expect(() => loadServerEnv(source)).toThrow(/OSS_BUCKET/)
  })

  it('错误信息不包含任何已配置的变量值（防止日志泄漏密钥）', () => {
    const source = { ...validSource }
    delete source.ALIBABA_CLOUD_ACCESS_KEY_SECRET

    try {
      loadServerEnv(source)
      expect.unreachable('应当抛出 MissingEnvError')
    } catch (error) {
      const message = (error as Error).message
      expect(message).not.toContain('test-ak-id')
      expect(message).not.toContain('test-bucket')
      expect(message).not.toContain('uploads/')
    }
  })

  it('来源对象为空时抛出并列出全部变量名', () => {
    expect(() => loadServerEnv({})).toThrow(MissingEnvError)
  })
})
