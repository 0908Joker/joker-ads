import fs from 'fs'

const commons = await (await fetch('https://fbi.xdx794.com/app/1.1.177/commons-a0fae99.js')).text()
const app = await (await fetch('https://fbi.xdx794.com/app/1.1.177/app-8a8ce71.js')).text()

function allSnips(t, n, win = 220, max = 8) {
  const out = []
  let from = 0
  while (out.length < max) {
    const i = t.indexOf(n, from)
    if (i < 0) break
    out.push(t.slice(Math.max(0, i - win), i + Math.floor(win * 1.5)).replace(/\s+/g, ' '))
    from = i + n.length
  }
  return out
}

const keys = [
  'path:"/recharge?type=vip"',
  'path:"/recharge?type=gold"',
  'path:"/recharge?type=diamond"',
  "path:'/recharge?type=vip'",
  "path:'/recharge?type=gold'",
  'path:"/recharge"',
  'toBuyVip',
  'toRecharge',
  'vipPromoBtn',
  'goldRecharge',
  'path:"/activityPage/dailyCheckIn"',
  'path:"/message"',
  'path:"/my/share"',
  'path:"/aiHome"',
  'path:"/aiGirlFriend"',
  'path:"/myBenefits"',
  'path:"/recharge/rechargeRecord"',
  'path:"/recharge/goldRecharge"',
  'myBenefits',
  'bindPhone',
  '会员中心',
]

const report = { keys: {}, apis: {} }
for (const k of keys) {
  const a = allSnips(commons, k, 180, 4)
  const b = allSnips(app, k, 180, 3)
  if (a.length || b.length) report.keys[k] = { commons: a, app: b }
}

report.goldBalance = allSnips(commons, '钻石余额', 200, 3)
report.openVip = allSnips(commons, '立即开通', 200, 6)
report.diamondLabel = allSnips(commons, '钻石充值', 200, 5)
report.vipCenter = allSnips(commons, '会员中心', 200, 5)
report.giftSnips = allSnips(commons, 'gift', 140, 40).filter((s) =>
  /router\.push|path:|icon|header|tool|click|message|activity|Benefits|share/i.test(s),
).slice(0, 20)

for (const n of [
  'recharge/commodity',
  'recharge/gold',
  'getRechargeCfg',
  'rechargeHistory',
  'diamondConsumeRecord',
  'energyExchangeVip',
  'payUrl',
  'orderNo',
  'mchOrder',
  'createOrder',
  'create_order',
]) {
  report.apis[n] = allSnips(app, n, 180, 2).concat(allSnips(commons, n, 180, 2)).slice(0, 4)
}

// Extract router.push near type=vip / type=gold with larger window
report.pushContexts = {
  typeVip: allSnips(commons, '/recharge?type=vip', 250, 8),
  typeGold: allSnips(commons, '/recharge?type=gold', 250, 8),
  typeDiamond: allSnips(commons, '/recharge?type=diamond', 250, 6),
  goldRechargePath: allSnips(commons, '/recharge/goldRecharge', 220, 6),
  dailyCheckIn: allSnips(commons, '/activityPage/dailyCheckIn', 220, 6),
  myShare: allSnips(commons, '/my/share', 220, 6),
  message: allSnips(commons, 'path:"/message"', 220, 6),
  myBenefits: allSnips(commons, '/myBenefits', 220, 6),
  aiHome: allSnips(commons, 'path:"/aiHome"', 220, 4),
  aiGirl: allSnips(commons, 'path:"/aiGirlFriend"', 220, 4),
}

fs.writeFileSync('crawled/_audit-19-nav-deep.json', JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      keyNames: Object.keys(report.keys),
      typeVip: report.pushContexts.typeVip.slice(0, 4),
      typeGold: report.pushContexts.typeGold.slice(0, 4),
      typeDiamond: report.pushContexts.typeDiamond.slice(0, 3),
      goldRechargePath: report.pushContexts.goldRechargePath.slice(0, 3),
      dailyCheckIn: report.pushContexts.dailyCheckIn.slice(0, 3),
      myShare: report.pushContexts.myShare.slice(0, 3),
      message: report.pushContexts.message.slice(0, 3),
      myBenefits: report.pushContexts.myBenefits.slice(0, 3),
      aiHome: report.pushContexts.aiHome.slice(0, 2),
      openVip: report.openVip.slice(0, 3),
      diamondLabel: report.diamondLabel.slice(0, 3),
      giftSnips: report.giftSnips.slice(0, 8),
      apis: Object.fromEntries(Object.entries(report.apis).map(([k, v]) => [k, (v[0] || '').slice(0, 240)])),
    },
    null,
    2,
  ),
)
