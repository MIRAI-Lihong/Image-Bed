<script setup lang="ts">
import ImageUploader from './components/ImageUploader.vue'
</script>

<template>
  <main class="app-shell">
    <section class="hero">
      <p class="eyebrow">Personal image host</p>
      <h1>个人图床</h1>
      <p class="summary">
        选择图片上传到阿里云 OSS，复制 URL / Markdown / HTML 链接，用于博客、README 与笔记。
      </p>
    </section>
    <ImageUploader />
  </main>
</template>
