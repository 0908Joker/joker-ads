<template>
  <section class="apps-grid">
    <button
      v-for="(app, index) in apps"
      :key="`${app.name}-${index}`"
      class="app-card"
      @click="$emit('open', app)"
    >
      <div class="app-card__cover">
        <img
          v-if="app.icon && !failed[index]"
          :src="app.icon"
          :alt="app.name"
          class="cover-img cover-img--real"
          loading="lazy"
          @error="failed[index] = true"
        />
        <div v-else class="cover-img" :style="{ background: iconColor(app.name, index) }">
          <span class="cover-text">{{ iconText(app.name) }}</span>
        </div>
      </div>
      <span class="app-card__name">{{ app.name }}</span>
    </button>
  </section>
</template>

<script setup>
import { reactive } from 'vue'

defineProps({
  apps: { type: Array, required: true },
})

defineEmits(['open'])

const failed = reactive({})

const palette = [
  ['#122028', '#0a141c'],
  ['#183040', '#0e1c28'],
  ['#1a2834', '#101820'],
  ['#142430', '#0c1820'],
]

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function iconColor(name, index) {
  const [a, b] = palette[(hash(name) + index) % palette.length]
  return `linear-gradient(145deg, ${a}, ${b})`
}

function iconText(name) {
  if (/PG/i.test(name)) return 'PG'
  if (/91/.test(name)) return '91'
  if (/KY|开元/i.test(name)) return 'KY'
  return name.slice(0, 2)
}
</script>

<style scoped>
.apps-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.28rem 0.14rem;
  margin: 0 var(--dw-pad-x);
  padding: 0.28rem 0 0.48rem;
  width: auto;
}

.app-card {
  background: transparent;
  border: none;
  color: inherit;
  min-width: 0;
  padding: 0;
  text-align: center;
}

.app-card__cover {
  aspect-ratio: 1;
  background: var(--dw-surface-2);
  border: 1px solid var(--dw-hair);
  border-radius: 0.28rem;
  box-shadow: 0 0.1rem 0.28rem rgba(0, 0, 0, 0.28);
  margin: 0 auto;
  max-width: 1.28rem;
  overflow: hidden;
  transition: transform 0.2s var(--dw-ease), border-color 0.2s var(--dw-ease);
  width: 100%;
}

.app-card:active .app-card__cover {
  border-color: var(--dw-line);
  transform: scale(0.96);
}

.cover-img {
  align-items: center;
  color: var(--dw-cyan-soft);
  display: flex;
  height: 100%;
  justify-content: center;
  width: 100%;
}

.cover-img--real {
  object-fit: cover;
}

.cover-text {
  font-size: 0.3rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.app-card__name {
  color: var(--dw-muted);
  display: block;
  font-size: 0.24rem;
  line-height: 1.3;
  margin-top: 0.12rem;
  overflow: hidden;
  padding: 0 0.02rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
