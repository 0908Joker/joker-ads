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
          v-if="app.icon"
          :src="app.icon"
          :alt="app.name"
          class="cover-img cover-img--real"
          loading="lazy"
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
defineProps({
  apps: { type: Array, required: true },
})

defineEmits(['open'])

const palette = [
  ['#ff2d55', '#ed2248'],
  ['#6c5ce7', '#a29bfe'],
  ['#00b894', '#55efc4'],
  ['#fdcb6e', '#e17055'],
  ['#0984e3', '#74b9ff'],
  ['#e84393', '#fd79a8'],
  ['#2d3436', '#636e72'],
  ['#d63031', '#fab1a0'],
]

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function iconColor(name, index) {
  const [a, b] = palette[(hash(name) + index) % palette.length]
  return `linear-gradient(135deg, ${a}, ${b})`
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
  grid-template-columns: repeat(5, 1fr);
  gap: 0.21333rem 0.10667rem;
  padding: 0.32rem 0.21333rem 0.53333rem;
}

.app-card {
  background: transparent;
  border: none;
  color: inherit;
  padding: 0;
  text-align: center;
}

.app-card__cover {
  background: #2a2a2a;
  border-radius: 0.32rem;
  box-shadow: rgba(0, 0, 0, 0.18) 0 0.21333rem 0.48rem;
  height: 1.41333rem;
  margin: 0 auto;
  overflow: hidden;
  width: 1.41333rem;
}

.cover-img {
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  width: 100%;
}

.cover-img--real {
  object-fit: cover;
}

.cover-text {
  font-size: 0.32rem;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.app-card__name {
  color: rgba(255, 255, 255, 0.72);
  display: block;
  font-size: 0.29333rem;
  line-height: 1.3;
  margin-top: 0.10667rem;
  overflow: hidden;
  padding: 0 0.05333rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
