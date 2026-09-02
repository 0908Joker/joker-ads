import fs from 'fs'

const commons = await (await fetch('https://fbi.xdx794.com/app/1.1.177/commons-a0fae99.js')).text()

function snips(n, win = 500, max = 4) {
  const o = []
  let f = 0
  while (o.length < max) {
    const i = commons.indexOf(n, f)
    if (i < 0) break
    o.push(commons.slice(Math.max(0, i - win), i + win).replace(/\s+/g, ' '))
    f = i + n.length
  }
  return o
}

const report = {
  downloadManager: snips('/my/downloadManager'),
  history: snips('path:"/my/history"'),
  invite: snips('path:"/my/invite"'),
  share: snips('path:"/my/share"'),
  feedback: snips('path:"/my/feedback"'),
  official: snips('path:"/my/official"'),
  recruit: snips('path:"/my/recruit"'),
  bindPhone: snips('path:"/my/bindPhone"'),
  bindEmail: snips('modifyEmail'),
  myVideos: snips('/myVideos'),
  myRecords: snips('/myRecords'),
  myBenefits: snips('path:"/myBenefits"'),
  rechargeRecord: snips('path:"/recharge/rechargeRecord"'),
  buyRecord: snips('path:"/recharge/buyRecord"'),
  pointsMallPath: snips('path:"/pointsMall"'),
  aiTools: snips('path:"/aiTools"'),
  aiGirlFriend: snips('path:"/aiGirlFriend"'),
  identity: snips('identity'),
  vipCardClick: snips('toVip'),
  openVipPage: snips('openVip'),
  goRecharge: snips('goRecharge'),
  onVip: snips('onVip'),
  clickVip: snips('clickVip'),
  // menu config style
  menuPath: snips('downloadManager'),
}

// Heuristic: find objects with title+path near Chinese service labels by searching path constants used by my page
const pathConsts = [
  '/my/downloadManager',
  '/my/history',
  '/my/invite',
  '/my/share',
  '/my/feedback',
  '/my/official',
  '/my/recruit',
  '/my/bindPhone',
  '/my/modifyEmail',
  '/myVideos',
  '/myRecords',
  '/myBenefits',
  '/recharge/rechargeRecord',
  '/recharge/buyRecord',
  '/pointsMall',
  '/message',
  '/aiHome',
  '/aiTools',
  '/aiGirlFriend',
  '/activityPage/dailyCheckIn',
  '/recharge?type=vip',
  '/recharge?type=gold',
  '/recharge?type=diamond',
  '/recharge',
]
report.pathHits = {}
for (const p of pathConsts) {
  report.pathHits[p] = snips(p, 280, 3)
}

fs.writeFileSync('crawled/_audit-19-mine-paths.json', JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      downloadManager: report.downloadManager[0]?.slice(0, 400),
      myRecords: report.myRecords[0]?.slice(0, 400),
      myBenefits: report.myBenefits[0]?.slice(0, 400),
      pointsMallPath: report.pointsMallPath[0]?.slice(0, 400),
      rechargeRecord: report.rechargeRecord[0]?.slice(0, 400),
      pathSummary: Object.fromEntries(
        Object.entries(report.pathHits).map(([k, v]) => [k, v.slice(0, 1).map((s) => s.slice(0, 220))]),
      ),
    },
    null,
    2,
  ),
)
