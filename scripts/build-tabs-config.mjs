#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/tab-pages-full.json'), 'utf8'))
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))

function parseFeatured(body) {
  const tabs = full.pages.featured.headerTabs || []
  const chips = ['💛AIGC涩剧💖', '巨乳翘臀', '白虎嫩穴', '网爆黑料', '强奸灌醉', '反差母狗', '网红尤物', '约炮偷情']
  const videos = [
    { title: '被主人的插入式玩具电击器贴调教高潮失禁', views: '2.2w', duration: '29:22' },
    { title: '潮喷淫娃小水水母狗情趣皮衣深喉高潮喷水.', views: '5.5w', duration: '12:45' },
    { title: '[Octokuro]粉色胶衣与黑色胶衣联动女同做爱后3p做爱六洞齐开', views: '4.9w', duration: '40:37' },
    { title: '户外口精，爆操娇嫩小美女', views: '8574', duration: '01:34:38' },
  ]
  return { tabs, chips, subTabs: ['推荐', '最新', '最热'], videos, ad: { name: 'SQ直播', viewers: '5362人 正在看' } }
}

function parseDouyin(body) {
  return {
    tabs: full.pages.douyin.headerTabs || ['抖阴', '福利姬', 'TikTok', 'AI', '动漫', '短剧'],
    items: [
      { user: '@老阿姨的少女心', title: '线上调教小母狗学生校花', tags: ['#母狗', '#调教'], likes: 1451, comments: 12, shares: 18 },
      { user: '@老阿姨的少女心', title: '极品反差婊', tags: ['#反差婊', '#极品美女'], likes: 349, comments: 10, shares: 14 },
    ],
  }
}

function parseDark() {
  return { tags: ['强奸', '学生', '自慰', '妈妈', '乱伦', '巨乳', '户外', '内射'] }
}

function parseCircle(body) {
  const groups = [
    { name: '老司机解说', count: '94个帖子' },
    { name: '女优资讯', count: '435个帖子' },
    { name: '骚货', count: '4864个帖子' },
    { name: 'cosplay', count: '274个帖子' },
    { name: '品茶约炮', count: '404个帖子' },
    { name: '反差婊爆料', count: '1620个帖子' },
    { name: '吃瓜', count: '11192个帖子' },
    { name: '裸聊直播', count: '337个帖子' },
  ]
  const posts = [
    { user: '小红书官方', time: '2026.6.16 16:37', title: '💞全国外围💞1234线城市上门服务安排!《人到满意付款》', tag: '#外围', likes: 115, comments: 32, views: '118697', pinned: true },
    { user: '全网最牛真实露脸反差婊调教', time: '2026.8.10 17:50', title: '台湾某传媒大学，颜值超高的美少女学姐与男友的性爱私密视频流出…', tag: '#反差婊爆料', likes: 74, comments: 1, views: '908' },
    { user: '18撸王', time: '2026.8.9 16:07', title: '做爱减肥真可以？ 5种爱爱姿势越做身材越好！', tag: '#性爱知识', likes: 0, comments: 0, views: '0' },
  ]
  return {
    topic: { title: '第一百零五期 做爱减肥真可以？ 5种爱爱姿', participants: 175, pro: '33.14%', con: '66.86%' },
    groups,
    posts,
  }
}

function parseAnime() {
  return {
    tabs: ['漫画', '动漫', '小说', '美图', '黄游'],
    vipBanner: '您还不是会员 开通会员',
    filters: ['全部', '主题A漫', '角色扮演', '特殊PLAY', '其他', '单本'],
    comics: [
      { title: '继母与继姐', type: '韩漫', status: '连载' },
      { title: '顶加套房的春天', type: '韩漫', status: '连载' },
      { title: '秘密教学 / 秘密の授业', type: '女性向', status: '连载' },
      { title: '堕落圣女如何与恶魔共存', type: '女性向', status: '连载' },
      { title: '大小姐能有什么坏心眼呢？', type: '韩漫', status: '连载' },
      { title: '走味的初恋/不正常关系', type: '韩漫', status: '连载' },
    ],
  }
}

function parseMine() {
  return {
    user: { id: '1000147570704', name: '斯卡纳', bio: '这家伙很懒，什么也没有留下…' },
    stats: { follow: 0, like: 0, fav: 0 },
    quickApps: config.apps.filter((a) => ['免费看片', '上门约炮', '新葡京', '同城约炮', '波多涩漫'].includes(a.name)).slice(0, 5),
    services: ['绑定邮箱', '下载管理', '我的视频', '浏览记录', '邀请码', '我的福利', '分享邀请', '订单记录', '帮助反馈', '官方交流群', '原创入驻', '客服中心', '版本检测', '消息', '商务合作'],
    version: 'v1.1.168',
    task: '完成签到可恢复断签并领取奖励',
  }
}

const tabs = {
  routes: {
    apps: '/appcenter',
    featured: '/videosPage',
    douyin: '/short',
    dark: '/darkWeb/darkSecond',
    circle: '/circle',
    anime: '/vipPage',
    mine: '/my',
  },
  featured: parseFeatured(),
  douyin: parseDouyin(),
  dark: parseDark(),
  circle: parseCircle(),
  anime: parseAnime(),
  mine: parseMine(),
}

fs.writeFileSync(path.join(ROOT, 'src/data/tabs.json'), JSON.stringify(tabs, null, 2))
console.log('✅ src/data/tabs.json')
