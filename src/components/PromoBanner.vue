<template>
  <a
    class="promo-banner"
    :href="href || undefined"
    target="_blank"
    rel="noopener noreferrer"
    @click="onClick"
  >
    <div class="promo-banner__bg" />
    <div class="promo-banner__content">
      <span class="promo-banner__tag">{{ tag }}</span>
      <span class="promo-banner__text">{{ text }}</span>
    </div>
  </a>
</template>

<script setup>
const props = defineProps({
  tag: { type: String, default: '限时' },
  text: { type: String, default: '聊天不限制' },
  signUrl: { type: String, default: '' },
  url: { type: String, default: '' },
})

const href = props.signUrl || props.url

function onClick(e) {
  if (!href) e.preventDefault()
}
</script>

<style scoped>
.promo-banner {
  display: block;
  margin: 0.21333rem 0.32rem 0;
  position: relative;
  text-decoration: none;
  z-index: 1;
}

.promo-banner__bg {
  background: linear-gradient(90deg, #ff6b8a, #ff2d55 50%, #c0392b);
  border-radius: 0.24rem;
  height: 1.06667rem;
  overflow: hidden;
  position: relative;
}

.promo-banner__bg::before {
  background: radial-gradient(circle at 80% 50%, rgba(255, 255, 255, 0.25), transparent 50%);
  content: '';
  inset: 0;
  position: absolute;
}

.promo-banner__content {
  align-items: center;
  display: flex;
  gap: 0.16rem;
  inset: 0;
  justify-content: center;
  position: absolute;
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
