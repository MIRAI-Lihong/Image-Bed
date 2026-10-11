<script setup lang="ts">
import { ref } from 'vue'
import ImageUploader from './components/ImageUploader.vue'
import UploadHistory from './components/UploadHistory.vue'
import { historyStore, type HistoryItem, type NewHistoryItem } from './services/history'

const historyItems = ref<HistoryItem[]>(historyStore.list())

function onUploaded(record: NewHistoryItem): void {
  historyItems.value = historyStore.add(record)
}

function onRemoveHistory(id: string): void {
  historyItems.value = historyStore.remove(id)
}
</script>

<template>
  <main class="app-shell">
    <section class="hero">
      <p class="eyebrow">Personal image host</p>
      <h1>个人图床</h1>
    </section>
    <ImageUploader @uploaded="onUploaded" />
    <UploadHistory :items="historyItems" @remove="onRemoveHistory" />
  </main>
</template>
