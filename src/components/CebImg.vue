<template>
  <div class="ceb-wrap">
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="ceb-img"
      loading="lazy"
      @error="src = ''"
    />
    <div v-else class="ceb-ph" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { decryptMedia } from '../api/media.js'

const props = defineProps({
  path: { type: String, default: '' },
  alt: { type: String, default: '' },
})

const src = ref('')
let loadGen = 0

async function load() {
  const gen = ++loadGen
  src.value = ''
  if (!props.path) return
  try {
    const next = await decryptMedia(props.path)
    if (gen === loadGen) src.value = next || ''
  } catch {
    if (gen === loadGen) src.value = ''
  }
}

watch(() => props.path, load)
onMounted(load)
</script>

<style scoped>
.ceb-wrap {
  display: block;
  height: 100%;
  overflow: hidden;
  width: 100%;
}
.ceb-img,
.ceb-ph {
  background: linear-gradient(135deg, #3a3a3a, #1a1a1a);
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}
</style>
