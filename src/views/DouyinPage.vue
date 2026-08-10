<template>
  <TabShell active="douyin">
    <nav class="tabs">
      <button v-for="tab in data.tabs" :key="tab" class="tab" :class="{ 'is-active': active === tab }" @click="active = tab">{{ tab }}</button>
    </nav>
    <section class="feed">
      <article v-for="(item, i) in data.items" :key="i" class="short-card">
        <div class="video-area">
          <div class="overlay">
            <p class="user">{{ item.user }}</p>
            <p class="title">{{ item.title }}</p>
            <div class="tags">
              <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
            </div>
            <div class="actions">
              <span>{{ item.likes }}</span>
              <span>{{ item.comments }}</span>
              <span>{{ item.shares }}</span>
              <button>分享</button>
              <button>打赏</button>
            </div>
          </div>
        </div>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref } from 'vue'
import TabShell from '../components/TabShell.vue'
import tabs from '../data/tabs.json'

const data = tabs.douyin
const active = ref('抖阴')
</script>

<style scoped>
.tabs { display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.32rem; white-space: nowrap; }
.tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.4rem; }
.tab.is-active { color: #fff; font-weight: 700; }
.feed { padding: 0 0.32rem; }
.short-card { margin-bottom: 0.32rem; }
.video-area { background: linear-gradient(180deg,#222,#111); border-radius: 0.24rem; height: 8rem; overflow: hidden; position: relative; }
.overlay { bottom: 0; left: 0; padding: 0.32rem; position: absolute; right: 0; }
.user { color: #fff; font-size: 0.32rem; font-weight: 600; }
.title { color: rgba(255,255,255,.85); font-size: 0.34rem; margin-top: 0.12rem; }
.tags { display: flex; flex-wrap: wrap; gap: 0.12rem; margin-top: 0.16rem; }
.tags span { color: #7ecbff; font-size: 0.28rem; }
.actions { align-items: center; display: flex; gap: 0.24rem; margin-top: 0.24rem; }
.actions span { color: rgba(255,255,255,.6); font-size: 0.28rem; }
.actions button { background: rgba(255,255,255,.12); border: none; border-radius: 0.8rem; color: #fff; font-size: 0.26rem; padding: 0.08rem 0.24rem; }
</style>
