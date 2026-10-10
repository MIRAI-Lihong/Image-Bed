import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 本地开发：授权接口代理到 netlify functions（netlify functions serve 默认 8888 端口）
      // 显式使用 127.0.0.1，避免 localhost 解析为 IPv6 回环导致代理连接失败
      '/api': 'http://127.0.0.1:8888',
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts'],
  },
})
