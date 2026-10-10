<script setup lang="ts">
const confirmedDecisions = [
  'OSS bucket is public-read.',
  'Uploads use Netlify Functions and STS temporary credentials.',
  'No UI library in the first iteration.',
  'GitHub Actions is deferred for now.',
]
</script>

<template>
  <main class="app-shell">
    <section class="hero">
      <p class="eyebrow">Foundation Ready</p>
      <h1>Personal image host</h1>
      <p class="summary">
        This project is starting with a small Vue 3 + TypeScript + Vite baseline so we can
        add security, validation, and upload features in clear steps.
      </p>
    </section>

    <section class="panel">
      <h2>Confirmed boundaries</h2>
      <ul>
        <li v-for="item in confirmedDecisions" :key="item">
          {{ item }}
        </li>
      </ul>
    </section>
  </main>
</template>
