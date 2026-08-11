<template>
  <nav class="tabbar">
    <button
      v-for="item in items"
      :key="item.id"
      class="tabbar-item"
      :class="{ 'is-active': active === item.id }"
      @click="$emit('change', item.id)"
    >
      <span class="tabbar-item__icon" v-html="icons[item.icon]" />
      <span class="tabbar-item__text">{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
  active: { type: String, default: 'apps' },
})

defineEmits(['change'])

const icons = {
  grid: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18h18M5 18l1-8 4 4 3-6 3 6 4-4 1 8"/></svg>`,
  music: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 3v10.5a3.5 3.5 0 1 0 2 3.15V6.5l8-2.5v8a3.5 3.5 0 1 0 2 3.15V3l-12 3z"/></svg>`,
  skull: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="10" r="6"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><path d="M9 18v3M12 18v3M15 18v3"/></svg>`,
  planet: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="12" ry="4" transform="rotate(-30 12 12)"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>`,
}
</script>

<style scoped>
.tabbar {
  background-color: #171512;
  bottom: 0;
  box-sizing: border-box;
  display: flex;
  height: 1.53846rem;
  left: 0;
  padding-bottom: env(safe-area-inset-bottom);
  position: fixed;
  right: 0;
  width: 100%;
  z-index: 100;
}

.tabbar-item {
  align-items: center;
  background: transparent;
  color: #646566;
  cursor: pointer;
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: 0.26rem;
  justify-content: center;
  line-height: 1;
  padding: 0.13333rem 0;
}

.tabbar-item.is-active {
  background-color: #171512;
  color: #f81942;
  font-weight: 500;
}

.tabbar-item__icon {
  align-items: center;
  display: flex;
  height: 0.53333rem;
  justify-content: center;
  margin-bottom: 0.10667rem;
}

.tabbar-item__text {
  font-size: 0.24rem;
}
</style>
