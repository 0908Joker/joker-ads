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

const props = defineProps({
  tag: { type: String, default: '限时' },
  text: { type: String, default: '聊天不限制' },
  signUrl: { type: String, default: '' },
  url: { type: String, default: '' },
  cover: { type: String, default: '' },
  image: { type: String, default: '' },
})

const href = props.signUrl || props.url
const localSrc = props.image || ''

function onClick(e) {
  if (!href) e.preventDefault()
}
</script>

<style scoped>
.promo-banner {
  display: block;
  margin: 0.21333rem 0.32rem 0;
  overflow: hidden;
  position: relative;
  text-decoration: none;
  z-index: 1;
}

.promo-banner__img {
  border-radius: 0.24rem;
  display: block;
  height: 1.06667rem;
  object-fit: cover;
  width: 100%;
}

:deep(.promo-banner__img) {
  border-radius: 0.24rem;
  height: 1.06667rem;
  width: 100%;
}

.promo-banner__fallback {
  align-items: center;
  background: linear-gradient(90deg, #ff6b8a, #ff2d55 50%, #c0392b);
  border-radius: 0.24rem;
  display: flex;
  gap: 0.16rem;
  height: 1.06667rem;
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
