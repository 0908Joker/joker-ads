import fs from 'fs'

const commons = await (await fetch('https://fbi.xdx794.com/app/1.1.177/commons-a0fae99.js')).text()
const app = await (await fetch('https://fbi.xdx794.com/app/1.1.177/app-8a8ce71.js')).text()
const vendors = '' // skip huge unless needed

function snips(src, n, win = 320, max = 5) {
  const o = []
  let f = 0
  while (o.length < max) {
    const i = src.indexOf(n, f)
    if (i < 0) break
    o.push(src.slice(Math.max(0, i - win), i + win).replace(/\s+/g, ' '))
    f = i + n.length
  }
  return o
}

const needles = [
  '限时特惠',
  '权限等你开启',
  '充值越高赠送越多',
  'vip会员中心',
  'VIP会员中心',
  '会员中心',
  '钻石充值',
  '立即开通',
  '立即充值',
  '权利象征',
  '女友相伴',
  '邀请好友得好礼',
  '注册/绑定有礼',
  '完成签到可恢复',
  'onClickWelfare',
  'onClickShare',
  'onClickUpload',
  'onClickRefresh',
  'pointsMall',
  'myRecords',
  'rechargeRecord',
  'query.type',
  'type===\"vip\"',
  'type==\"vip\"',
  'type===\"gold\"',
  'type==\"gold\"',
  'type===\"diamond\"',
  'goldRecharge',
  'vipRecharge',
]

const report = { commons: {}, app: {} }
for (const n of needles) {
  const c = snips(commons, n)
  const a = snips(app, n)
  if (c.length) report.commons[n] = c
  if (a.length) report.app[n] = a
}

// Look for my page menu config arrays with path fields near service names
for (const n of ['绑定邮箱', '下载管理', '我的视频', '浏览记录', '邀请码', '我的福利', '分享邀请', '订单记录', '帮助反馈']) {
  report.commons['svc_' + n] = snips(commons, n, 400, 2)
}

fs.writeFileSync('crawled/_audit-19-mine-strings.json', JSON.stringify(report, null, 2))

const summary = {}
for (const [k, v] of Object.entries(report.commons)) {
  summary[k] = (v[0] || '').slice(0, 280)
}
console.log(JSON.stringify(summary, null, 2))
