<template>
  <header class="hero">
    <div class="hero__overlay" />
    <div class="hero__glow hero__glow--left" />
    <div class="hero__glow hero__glow--right" />

    <div class="hero__brand">
      <span class="brand">
        <svg class="brand__mark" viewBox="0 0 14 18" aria-hidden="true">
          <path d="M2.6 2.4 5.4 5.2" />
          <path d="M1.8 7.4 4.6 10.2" />
          <path d="M2.8 15 6.6 11.9" />
        </svg>
        <span class="brand__name">得污</span>
      </span>
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
        <span>{{ mode.label }}</span>
        <span v-if="mode.emoji" class="mode-switch__emoji">{{ mode.emoji }}</span>
        <span v-else-if="mode.icon" class="mode-switch__icon">{{ mode.icon }}</span>
      </button>
    </div>
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
  background: linear-gradient(rgba(255, 45, 85, 0.96), rgba(237, 34, 72, 0.92) 62%, rgba(17, 17, 17, 0));
  overflow: hidden;
  padding-bottom: 0.37333rem;
  position: sticky;
  top: 0;
  z-index: 20;
}

.hero__overlay {
  background:
    radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.18), transparent 18%),
    radial-gradient(circle at 85% 10%, rgba(255, 255, 255, 0.16), transparent 16%);
  inset: 0;
  opacity: 0.55;
  pointer-events: none;
  position: absolute;
}

.hero__glow {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  filter: blur(0.26667rem);
  height: 4.8rem;
  pointer-events: none;
  position: absolute;
  top: -1.12rem;
  width: 4.8rem;
}

.hero__glow--left { left: -1.49333rem; }
.hero__glow--right { right: -1.76rem; }

.hero__brand {
  padding: 0.24rem 0.32rem 0.04rem;
  position: relative;
  z-index: 1;
}

.brand {
  align-items: center;
  display: inline-flex;
  gap: 0.14rem;
}

/* 氵 from 污, drawn as three strokes so the mark is native to the name. */
.brand__mark {
  fill: none;
  height: 0.5rem;
  stroke: #ffd24a;
  stroke-linecap: round;
  stroke-width: 3;
  width: 0.38rem;
}

.brand__name {
  color: #fff;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.04rem;
  line-height: 1;
  text-shadow: 0 0.02rem 0.08rem rgba(0, 0, 0, 0.28);
}

.hero__tabs {
  align-items: center;
  display: flex;
  gap: 0.53333rem;
  overflow-x: auto;
  padding: 0.32rem 0.32rem 0;
  position: relative;
  white-space: nowrap;
  z-index: 1;
  scrollbar-width: none;
}

.hero__tab {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.94);
  font-size: 0.45333rem;
  line-height: 0.74667rem;
  padding: 0 0 0.26667rem;
  position: relative;
  flex-shrink: 0;
}

.hero__tab.is-active {
  color: #fff;
  font-size: 0.48rem;
  font-weight: 600;
}

.hero__tab.is-active::after {
  background: #f81942;
  border-radius: 26.64rem;
  bottom: 0;
  content: '';
  height: 0.10667rem;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 0.53333rem;
}

.mode-switch {
  align-items: center;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 0.58667rem;
  box-shadow: rgba(0, 0, 0, 0.18) 0 0.37333rem 0.74667rem;
  display: flex;
  gap: 0.10667rem;
  margin: 0.26667rem 0.32rem 0;
  padding: 0.10667rem;
  position: relative;
  z-index: 1;
}

.mode-switch__item {
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 0.48rem;
  color: #222;
  display: flex;
  flex: 1;
  font-size: 0.48rem;
  font-weight: 500;
  gap: 0.16rem;
  height: 0.96rem;
  justify-content: center;
}

.mode-switch__item.is-active {
  background: linear-gradient(#323232, #1f1f1f);
  box-shadow: rgba(255, 255, 255, 0.9) 0 0 0 0.05333rem inset;
  color: #fff;
}

.mode-switch__emoji,
.mode-switch__icon {
  color: #f81942;
  font-size: 0.42667rem;
  line-height: 1;
}
</style>
