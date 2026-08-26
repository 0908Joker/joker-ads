<template>
  <a
    class="promo-banner"
    :href="href || undefined"
    target="_blank"
    rel="noopener noreferrer"
    @click="onClick"
  >
    <img v-if="localSrc" class="promo-banner__img" :src="localSrc" alt="" />
    <CebImg v-else-if="cover" class="promo-banner__img" :path="cover" />
    <div v-else class="promo-banner__fallback">
      <span class="promo-banner__tag">{{ tag }}</span>
      <span class="promo-banner__text">{{ text }}</span>
    </div>
  </a>
</template>

<script setup>
import CebImg from './CebImg.vue'
import { resolveAdTarget, trackAdSign } from '../api/ad.js'

const props = defineProps({
  tag: { type: String, default: '限时' },
  text: { type: String, default: '聊天不限制' },
  signUrl: { type: String, default: '' },
  url: { type: String, default: '' },
  cover: { type: String, default: '' },
  image: { type: String, default: '' },
})

const href = resolveAdTarget(props)
const localSrc = props.image || ''

function onClick(e) {
  if (!href) {
    e.preventDefault()
    return
  }
  trackAdSign(props.signUrl)
}
</script>

<style scoped>
/* Creative is 636x200; a fixed height crushed it to ~8.4:1 and cover cropped
   away both lines of copy, so the slot follows the artwork's ratio instead. */
.promo-banner {
  aspect-ratio: 636 / 200;
  border-radius: 0.24rem;
  display: block;
  margin: 0.21333rem 0.32rem 0;
  overflow: hidden;
  position: relative;
  text-decoration: none;
  z-index: 1;
}

.promo-banner__img,
:deep(.promo-banner__img) {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.promo-banner__fallback {
  align-items: center;
  background: linear-gradient(90deg, #ff6b8a, #ff2d55 50%, #c0392b);
  display: flex;
  gap: 0.16rem;
  height: 100%;
  justify-content: center;
}

.promo-banner__tag {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 0.08rem;
  color: #fff;
  font-size: 0.24rem;
  padding: 0.04rem 0.12rem;
}

.promo-banner__text {
  color: #fff;
  font-size: 0.42667rem;
  font-weight: 700;
  letter-spacing: 0.04rem;
}
</style>
