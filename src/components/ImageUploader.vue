<script setup lang="ts">
import { markRaw, reactive, ref } from 'vue'
import { authorizationClient } from '../services/authorization'
import { createImageUploader } from '../services/upload'
import type { UploadItem } from '../types/image'
import { copyText } from '../utils/clipboard'
import { formatFileSize, validateImageFile } from '../utils/file'
import { toHtml, toMarkdown } from '../utils/formats'

const COPY_FORMATS = [
  { format: 'url', label: 'URL' },
  { format: 'markdown', label: 'Markdown' },
  { format: 'html', label: 'HTML' },
] as const

type CopyFormat = (typeof COPY_FORMATS)[number]['format']

const items = ref<UploadItem[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const copiedKey = ref<string | null>(null)
const uploader = createImageUploader()

function triggerFileSelect(): void {
  fileInput.value?.click()
}

async function onFilesSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  await addFiles(files)
}

async function addFiles(files: File[]): Promise<void> {
  for (const file of files) {
    const validationError = validateImageFile(file)
    const item: UploadItem = reactive({
      id: `${file.name}-${file.size}-${file.lastModified}-${items.value.length}`,
      // File 是浏览器原生对象，标记 raw 避免被深度代理；其余字段保持响应式
      file: markRaw(file),
      fileName: file.name,
      fileSize: file.size,
      previewUrl: validationError ? '' : URL.createObjectURL(file),
      status: validationError ? 'error' : 'pending',
      error: validationError,
      result: null,
    })
    items.value.push(item)
    if (!validationError) {
      void startUpload(item)
    }
  }
}

async function startUpload(item: UploadItem): Promise<void> {
  item.status = 'uploading'
  item.error = undefined
  try {
    const auth = await authorizationClient.getAuthorization()
    const uploaded = await uploader.upload(item.file, auth)
    item.status = 'success'
    item.result = { objectKey: uploaded.objectKey, url: uploaded.url }
  } catch (error) {
    item.status = 'error'
    item.error = error instanceof Error ? error.message : String(error)
  }
}

function retryUpload(item: UploadItem): void {
  void startUpload(item)
}

async function copyLink(item: UploadItem, format: CopyFormat): Promise<void> {
  if (!item.result) return
  const alt = item.fileName
  const text =
    format === 'url'
      ? item.result.url
      : format === 'markdown'
        ? toMarkdown(item.result.url, alt)
        : toHtml(item.result.url, alt)

  if (await copyText(text)) {
    copiedKey.value = `${item.id}:${format}`
    setTimeout(() => {
      if (copiedKey.value === `${item.id}:${format}`) copiedKey.value = null
    }, 1500)
  }
}
</script>

<template>
  <section class="panel uploader">
    <div class="select-area">
      <button type="button" class="primary-btn" @click="triggerFileSelect">选择图片</button>
      <p class="hint">支持 PNG / JPG / GIF / WebP，可多选</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        hidden
        @change="onFilesSelected"
      />
    </div>

    <ul v-if="items.length" class="upload-list">
      <li v-for="item in items" :key="item.id" class="upload-item">
        <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.fileName" class="thumb" />
        <div v-else class="thumb thumb-invalid" aria-hidden="true"></div>

        <div class="meta">
          <p class="name">{{ item.fileName }}</p>
          <p class="size">{{ formatFileSize(item.fileSize) }}</p>
          <p v-if="item.status === 'uploading'" class="status status-uploading">上传中…</p>
          <p v-else-if="item.status === 'success'" class="status status-success">上传成功</p>
          <p v-else-if="item.error" class="status status-error">{{ item.error }}</p>
        </div>

        <div class="actions">
          <template v-if="item.status === 'success' && item.result">
            <button
              v-for="f in COPY_FORMATS"
              :key="f.format"
              type="button"
              class="copy-btn"
              @click="copyLink(item, f.format)"
            >
              {{ copiedKey === `${item.id}:${f.format}` ? '已复制' : `复制 ${f.label}` }}
            </button>
          </template>
          <button
            v-if="item.status === 'error'"
            type="button"
            class="retry-btn"
            @click="retryUpload(item)"
          >
            重试
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
