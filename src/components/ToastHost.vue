<template>
  <div v-if="toasts.length" class="toast-host">
    <div v-for="t in toasts" :key="t.id" class="toast">{{ t.message }}</div>
  </div>
</template>

<script setup>
import { toasts } from '../composables/useToast.js'
</script>

<style scoped>
.toast-host {
  display: flex;
  flex-direction: column;
  gap: 0.16rem;
  left: 50%;
  pointer-events: none;
  position: fixed;
  top: 40%;
  transform: translateX(-50%);
  z-index: 2000;
}
.toast {
  background: rgba(0, 0, 0, 0.86);
  border-radius: 0.12rem;
  color: #fff;
  font-size: 0.28rem;
  max-width: 6rem;
  padding: 0.2rem 0.32rem;
  text-align: center;
}
</style>
