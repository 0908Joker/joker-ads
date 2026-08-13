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
  grid: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="1.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 19h18v-2H3v2zm1.5-4h15L21 7l-5 3-4-6-4 6-5-3 1.5 8z"/></svg>`,
  music: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17 3v10.26A4 4 0 1 0 19 17V7h4V3h-6zM7 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>`,
  skull: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2a8 8 0 0 0-8 8c0 3.2 1.8 6 4.4 7.4V20h2.2v2h2.8v-2H15.6v-2.6C18.2 16 20 13.2 20 10a8 8 0 0 0-8-8zM9 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`,
  planet: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="6.5"/><ellipse cx="12" cy="12" rx="11" ry="3.6" transform="rotate(-28 12 12)"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 4.8l6.6 11.4H5.4L12 4.8z"/><path d="M12 19.2L5.4 7.8h13.2L12 19.2z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="3"/><path d="M7 17.2c1.4-1.6 3.1-2.4 5-2.4s3.6.8 5 2.4"/></svg>`,
  smile: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M8.2 14.2c1.1 1.6 2.4 2.4 3.8 2.4s2.7-.8 3.8-2.4"/></svg>`,
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
