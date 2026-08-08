<template>
  <div class="promo-banner">
    <div class="promo-banner__bg" />
    <div class="promo-banner__content">
      <span class="promo-banner__tag">限时</span>
      <span class="promo-banner__text">聊天不限制</span>
    </div>
  </div>
</template>

<style scoped>
.promo-banner {
  margin: 0.21333rem 0.32rem 0;
  position: relative;
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
