<script setup lang="ts">
import { ref } from 'vue'
import type { HistoryItem } from '../services/history'
import { copyText } from '../utils/clipboard'
import { formatFileSize } from '../utils/file'
import { formatDateTime, toHtml, toMarkdown } from '../utils/formats'

const COPY_FORMATS = [
  { format: 'url', label: 'URL' },
  { format: 'markdown', label: 'Markdown' },
  { format: 'html', label: 'HTML' },
] as const

type CopyFormat = (typeof COPY_FORMATS)[number]['format']

defineProps<{ items: HistoryItem[] }>()
const emit = defineEmits<{ remove: [id: string] }>()

const copiedKey = ref<string | null>(null)

async function copyLink(item: HistoryItem, format: CopyFormat): Promise<void> {
  const text =
    format === 'url' ? item.url : format === 'markdown' ? toMarkdown(item.url, item.fileName) : toHtml(item.url, item.fileName)

  if (await copyText(text)) {
    copiedKey.value = `${item.id}:${format}`
    setTimeout(() => {
      if (copiedKey.value === `${item.id}:${format}`) copiedKey.value = null
    }, 1500)
  }
}
</script>

<template>
  <section class="panel history">
    <h2>上传历史</h2>
    <p v-if="items.length === 0" class="hint">暂无上传记录。记录仅保存在当前浏览器，最多保留 100 条。</p>
    <ul v-else class="upload-list">
      <li v-for="item in items" :key="item.id" class="upload-item">
        <img :src="item.url" :alt="item.fileName" class="thumb" loading="lazy" />
        <div class="meta">
          <p class="name">{{ item.fileName }}</p>
          <p class="size">{{ formatFileSize(item.size) }} · {{ formatDateTime(item.uploadedAt) }}</p>
          <a class="url" :href="item.url" target="_blank" rel="noopener" :title="item.url">{{ item.url }}</a>
        </div>
        <div class="actions">
          <button
            v-for="f in COPY_FORMATS"
            :key="f.format"
            type="button"
            class="copy-btn"
            @click="copyLink(item, f.format)"
          >
            {{ copiedKey === `${item.id}:${f.format}` ? '已复制' : `复制 ${f.label}` }}
          </button>
          <button type="button" class="remove-btn" @click="emit('remove', item.id)">移除</button>
        </div>
      </li>
    </ul>
  </section>
</template>
