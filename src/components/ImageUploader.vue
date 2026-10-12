<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, reactive, ref } from 'vue'
import { authorizationClient } from '../services/authorization'
import type { NewHistoryItem } from '../services/history'
import { createImageUploader } from '../services/upload'
import type { UploadItem } from '../types/image'
import { copyText } from '../utils/clipboard'
import { extractPasteImages, formatFileSize, validateImageFile } from '../utils/file'
import { toHtml, toMarkdown } from '../utils/formats'

const COPY_FORMATS = [
  { format: 'url', label: 'URL' },
  { format: 'markdown', label: 'Markdown' },
  { format: 'html', label: 'HTML' },
] as const

type CopyFormat = (typeof COPY_FORMATS)[number]['format']

/** 上传成功后通知父组件写入历史记录 */
const emit = defineEmits<{ uploaded: [record: NewHistoryItem] }>()

const items = ref<UploadItem[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const copiedKey = ref<string | null>(null)
const isDragging = ref(false)
const uploader = createImageUploader()

function triggerFileSelect(): void {
  fileInput.value?.click()
}

/** 拖拽经过时持续触发；preventDefault 是允许 drop 的前提 */
function onDragOver(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = true
}

/** 经过子元素边界时也会触发 dragleave，只在真正离开上传区时才取消高亮 */
function onDragLeave(event: DragEvent): void {
  const zone = event.currentTarget
  if (!(zone instanceof Node)) return
  if (zone.contains(event.relatedTarget as Node | null)) return
  isDragging.value = false
}

async function onDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  isDragging.value = false
  await addFiles(Array.from(event.dataTransfer?.files ?? []))
}

async function onFilesSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  await addFiles(files)
}

/**
 * 全局粘贴上传：剪贴板中的图片复用 addFiles 链路；非图片内容静默忽略。
 * paste 事件仅在页面获得焦点时触发，页面失焦时天然不响应。
 */
async function onPaste(event: ClipboardEvent): Promise<void> {
  const files = extractPasteImages(event.clipboardData)
  if (files.length === 0) return
  await addFiles(files)
}

onMounted(() => document.addEventListener('paste', onPaste))
onUnmounted(() => document.removeEventListener('paste', onPaste))

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
    emit('uploaded', {
      url: uploaded.url,
      objectKey: uploaded.objectKey,
      fileName: item.fileName,
      size: item.fileSize,
      uploadedAt: new Date().toISOString(),
    })
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

/** 最近一次上传成功的条目：手机端高频场景是一传完就复制 Markdown */
const latestSuccess = computed<UploadItem | null>(() => {
  for (let i = items.value.length - 1; i >= 0; i--) {
    const item = items.value[i]
    if (item?.status === 'success' && item.result) return item
  }
  return null
})

const quickCopied = ref(false)

async function copyLatestMarkdown(): Promise<void> {
  const item = latestSuccess.value
  if (!item?.result) return
  if (await copyText(toMarkdown(item.result.url, item.fileName))) {
    quickCopied.value = true
    setTimeout(() => {
      quickCopied.value = false
    }, 1500)
  }
}
</script>

<template>
  <section class="panel uploader">
    <div
      class="dropzone"
      :class="{ 'dropzone-active': isDragging, 'dropzone-compact': items.length > 0 }"
      role="button"
      tabindex="0"
      @click="triggerFileSelect"
      @keydown.enter="triggerFileSelect"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <svg class="dropzone-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15V4m0 0L8 8m4-4l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 20h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <p class="dropzone-title">{{ items.length > 0 ? '继续添加图片' : '点击选择或拖拽图片到此处' }}</p>
      <p class="hint">支持 PNG / JPG / GIF / WebP，可多选，支持 Ctrl+V 粘贴</p>
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
      <li v-for="item in items" :key="item.id" :class="['upload-item', `upload-item-${item.status}`]">
        <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.fileName" class="thumb" />
        <div v-else class="thumb thumb-invalid" aria-hidden="true"></div>

        <div class="meta">
          <p class="name">{{ item.fileName }}</p>
          <p class="size">{{ formatFileSize(item.fileSize) }}</p>
          <p v-if="item.status === 'uploading'" class="status status-uploading">
            <span class="status-icon" aria-hidden="true"></span>上传中…
          </p>
          <p v-else-if="item.status === 'success'" class="status status-success">
            <span class="status-icon" aria-hidden="true"></span>上传成功
          </p>
          <p v-else-if="item.error" class="status status-error">
            <span class="status-icon" aria-hidden="true"></span>{{ item.error }}
          </p>
          <a
            v-if="item.status === 'success' && item.result"
            class="url"
            :href="item.result.url"
            target="_blank"
            rel="noopener"
            :title="item.result.url"
          >{{ item.result.url }}</a>
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

    <button
      v-if="latestSuccess"
      type="button"
      class="quick-copy-btn"
      @click="copyLatestMarkdown"
    >
      {{ quickCopied ? '已复制 Markdown' : '复制最新图片 Markdown' }}
    </button>
  </section>
</template>
