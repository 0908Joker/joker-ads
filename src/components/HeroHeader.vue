<template>
  <header class="hero">
    <div class="hero__wash" aria-hidden="true" />
    <div class="hero__brand">
      <img class="brand-logo" src="/brand/logo.png" alt="得污" width="160" height="160" />
      <div class="brand-copy">
        <strong>得污</strong>
        <span>成人版</span>
      </div>
    </div>

    <nav class="hero__tabs">
      <button
        v-for="cat in categories"
        :key="cat"
        class="hero__tab"
        :class="{ 'is-active': activeCategory === cat }"
        @click="selectCategory(cat)"
      >
        {{ cat }}
      </button>
    </nav>

    <div class="mode-switch">
      <button
        v-for="mode in modes"
        :key="mode.id"
        class="mode-switch__item"
        :class="{ 'is-active': activeMode === mode.id }"
        @click="selectMode(mode.id)"
      >
        {{ mode.label }}
      </button>
    </div>

    <svg class="hero__wave" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 8 V4.2 Q25 0.4 50 3.2 T100 2.4 V8 Z" fill="currentColor" />
    </svg>
  </header>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  categories: { type: Array, required: true },
  modes: { type: Array, required: true },
})

const activeCategory = ref('官方推荐')
const activeMode = ref('recommend')

const emit = defineEmits(['category-change', 'mode-change'])

function selectCategory(cat) {
  activeCategory.value = cat
  emit('category-change', cat)
}

function selectMode(id) {
  activeMode.value = id
  emit('mode-change', id)
}
</script>

<style scoped>
.hero {
  background: linear-gradient(180deg, #0c1016 0%, #090b0e 72%);
  overflow: hidden;
  padding: 0.28rem 0 0.52rem;
  position: sticky;
  top: 0;
  z-index: 20;
}

.hero__wash {
  background:
    radial-gradient(ellipse 70% 90% at 8% -10%, rgba(0, 200, 232, 0.14), transparent 55%),
    radial-gradient(ellipse 50% 70% at 92% 0%, rgba(0, 120, 150, 0.08), transparent 50%);
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.hero__brand {
  align-items: center;
  display: flex;
  gap: 0.22rem;
  padding: 0 0.36rem 0.12rem;
  position: relative;
  z-index: 1;
  animation: brand-in 0.55s var(--dw-ease) both;
}

@keyframes brand-in {
  from { opacity: 0; transform: translateY(-0.12rem); }
  to { opacity: 1; transform: none; }
}

.brand-logo {
  border-radius: 0.26rem;
  box-shadow:
    0 0 0 1px rgba(0, 200, 232, 0.2),
    0 0.1rem 0.32rem rgba(0, 0, 0, 0.4);
  display: block;
  height: 1.04rem;
  object-fit: cover;
  width: 1.04rem;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  line-height: 1;
}

.brand-copy strong {
  color: #f5f7fa;
  font-size: 0.44rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.brand-copy span {
  align-self: flex-start;
  background: var(--dw-cyan);
  border-radius: 0.05rem;
  color: var(--dw-ink-on-cyan);
  font-size: 0.2rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 0.05rem 0.12rem;
}

.hero__tabs {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.22rem 0.36rem 0.04rem;
  position: relative;
  scrollbar-width: none;
  white-space: nowrap;
  z-index: 1;
}

.hero__tab {
  background: transparent;
  border: none;
  color: var(--dw-faint);
  flex-shrink: 0;
  font-size: 0.36rem;
  font-weight: 500;
  padding: 0.12rem 0 0.22rem;
  position: relative;
  transition: color 0.2s var(--dw-ease);
}

.hero__tab.is-active {
  color: var(--dw-text);
  font-size: 0.4rem;
  font-weight: 700;
}

.hero__tab.is-active::after {
  background: var(--dw-cyan);
  border-radius: 99px;
  bottom: 0.04rem;
  content: '';
  height: 0.06rem;
  left: 18%;
  position: absolute;
  right: 18%;
}

.mode-switch {
  background: rgba(15, 18, 24, 0.88);
  border: 1px solid var(--dw-hair);
  border-radius: 999px;
  display: flex;
  margin: 0.22rem 0.36rem 0;
  padding: 0.08rem;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(10px);
}

.mode-switch__item {
  background: transparent;
  border: none;
  border-radius: 999px;
  color: var(--dw-muted);
  flex: 1;
  font-size: 0.34rem;
  font-weight: 500;
  height: 0.84rem;
  transition: background 0.22s var(--dw-ease), color 0.22s var(--dw-ease);
}

.mode-switch__item.is-active {
  background: var(--dw-cyan);
  color: var(--dw-ink-on-cyan);
  font-weight: 700;
}

.hero__wave {
  bottom: -1px;
  color: var(--dw-bg);
  height: 0.28rem;
  left: 0;
  pointer-events: none;
  position: absolute;
  width: 100%;
  z-index: 2;
}
</style>
