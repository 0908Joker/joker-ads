import session from '../data/api-session.json'

const RES_BASE = (session.resBase || 'https://d17e80montytxe.cloudfront.net').replace(/\/$/, '')

export function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${RES_BASE}/${path.replace(/^\/+/, '')}`
}

export function formatCount(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n || '')
  if (v >= 10000) return `${(v / 10000).toFixed(1).replace(/\.0$/, '')}w`
  return String(v)
}

export function formatDuration(sec) {
  const s = Number(sec)
  if (!Number.isFinite(s) || s <= 0) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

export function normalizeVideo(item) {
  if (!item) return null
  const title = item.name || item.title || ''
  if (!title || title.length < 4) return null
  if (!item.id) return null
  return {
    id: item.id,
    title,
    views: formatCount(item.playCnt ?? item.hot ?? item.views),
    duration: formatDuration(item.time ?? item.duration),
    cover: mediaUrl(item.coverURL || item.verticalCoverURL || item.cover),
    coverLocal: item.coverLocal || '',
    likes: formatCount(item.likedCnt ?? item.likes),
    comments: formatCount(item.commentCnt ?? item.comments),
    videoUrl: mediaUrl(item.mp4PlayURL || item.videoUrl),
    user: item.uploadId ? `@${item.uploadId}` : item.user || '',
    avatar: mediaUrl(item.user?.avatarURL || item.avatarURL || ''),
    collects: formatCount(item.collectedCnt ?? item.collects),
  }
}

export function normalizeVideoDetail(data) {
  if (!data) return null
  const v = data.video || {}
  const tags = v.videoTags || v.tags || []
  const playCandidates = [
    data.url,
    data.previewUrl,
    ...shortPlayCandidates({}, v),
  ].filter((u, i, arr) => u && arr.indexOf(u) === i)
  const playUrl = playCandidates[0] || ''
  return {
    id: v.id,
    title: v.name || v.title || '',
    // Detail: signed API HLS first; then CDN playURL / raw mp4.
    playUrl,
    playCandidates,
    isPreview: !data.url && !!(data.previewUrl || playUrl),
    needBuy: !!data.buyVideo,
    trialSeconds: Number(data.trialPreviewSeconds) || 0,
    cover: v.coverURL || v.verticalCoverURL || '',
    views: formatCount(v.playCnt ?? v.hot),
    duration: formatDuration(v.time),
    likes: formatCount(v.likedCnt),
    comments: formatCount(v.commentCnt),
    collects: formatCount(v.collectedCnt),
    user: v.user?.username || '',
    tags: (Array.isArray(tags) ? tags : [])
      .map((t) => (typeof t === 'string' ? t : t?.name || ''))
      .filter(Boolean),
    others: (data.otherVideos || []).map(normalizeVideo).filter(Boolean),
  }
}

export function normalizeFeaturedPayload(data) {
  const list = data?.videos || data?.list || data?.records || []
  return list.map(normalizeVideo).filter(Boolean)
}

// Origin featured tabs load algoRecommend/getList; videos sit under childCategories.
export function normalizeAlgoFeaturedPayload(data) {
  if (!data) return []
  const direct = data?.videos || data?.list || data?.records
  if (Array.isArray(direct) && direct.length) return direct.map(normalizeVideo).filter(Boolean)
  const children = data?.childCategories || []
  const videos = []
  for (const child of children) {
    if (Array.isArray(child?.videos)) videos.push(...child.videos)
  }
  return videos.map(normalizeVideo).filter(Boolean)
}

/** Candidate streams for a short/detail row, best-first.
 * CDN `playURL` m3u8 is the reliable short-feed primary; signed `row.url` is
 * often missing `?s=` and returns「播放链接失效」. Never emit `web/files/*.mp4`.
 */
export function shortPlayCandidates(row, video = {}) {
  const out = []
  const push = (u) => {
    if (!u || out.includes(u)) return
    out.push(u)
  }
  const cdnHls = mediaUrl(video.playURL || row?.playURL || '')
  if (cdnHls && /\.m3u8(\?|$)/i.test(cdnHls)) push(cdnHls)
  push(row?.url || '')
  push(row?.previewUrl || '')
  // Skip origin mp4PlayURL — web/files and unsigned mp4s 404; HLS above is enough.
  return out
}

export function shortPlayUrl(row, video = {}) {
  return shortPlayCandidates(row, video)[0] || ''
}

export function normalizeShortPayload(data) {
  const list = data?.videoInfo || data?.videos || data?.list || []
  return list
    .map((row) => {
      const v = row.video || row
      const n = normalizeVideo(v)
      if (!n) return null
      const u = v.user || row.user || {}
      n.user = u.username ? `@${u.username}` : n.user
      n.avatar = mediaUrl(u.avatarURL || n.avatar)
      n.playCandidates = shortPlayCandidates(row, v)
      n.videoUrl = n.playCandidates[0] || ''
      const tags = row.tags || v.videoTags || v.tags || []
      n.hashtags = (Array.isArray(tags) ? tags : [])
        .map((t) => (typeof t === 'string' ? t : t?.name || t?.tag || ''))
        .filter(Boolean)
        .map((t) => (String(t).startsWith('#') ? t : `#${t}`))
      n.collects = formatCount(v.collectedCnt ?? n.collects)
      n.comments = formatCount(v.commentCnt ?? n.comments)
      n.likes = formatCount(v.likedCnt ?? n.likes)
      return n
    })
    .filter(Boolean)
}

export function normalizeUser(data, fallback = {}) {
  const u = data?.userInfo || data?.user || data || {}
  return {
    id: u.uid || u.id || fallback.id || '',
    name: u.nickName || u.username || u.name || fallback.name || '游客',
    bio: u.introduction || u.introduce || u.bio || fallback.bio || '这家伙很懒，什么也没有留下…',
  }
}

/** Wallet / VIP / invite fields the mine sub-pages render. */
export function normalizeAccount(data) {
  const u = data?.userInfo || data?.user || data || {}
  const vipUntil = u.vipEffectiveTime || ''
  const isVip = vipUntil ? new Date(vipUntil).getTime() > Date.now() : !!u.vip
  return {
    uid: u.uid || u.id || '',
    gold: Number(u.gold ?? 0),
    diamond: Number(u.diamond ?? 0),
    points: Number(u.points ?? 0),
    isVip,
    vipName: u.vipName || (isVip ? 'VIP' : '普通用户'),
    vipUntil: vipUntil ? String(vipUntil).slice(0, 10) : '',
    watchTickets: Number(u.watchTicketCount ?? 0),
    downloadTickets: Number(u.downloadTicketCount ?? 0),
    inviteCode: u.selfInviteCode || '',
    inviteCount: Number(u.inviteCnt ?? 0),
    downloadUrl: u.officialDownloadUrl || u.downloadUrl || '',
    customerUrl: (Array.isArray(u.customerUrls) ? u.customerUrls[0] : u.customerUrls) || '',
  }
}

/** Counts live on the user record; actionStats only carries comment/download tallies. */
export function normalizeStats(data, fallback = {}) {
  const s = data?.userInfo || data?.actionStats || data || {}
  return {
    follow: s.followCnt ?? s.follow ?? fallback.follow ?? 0,
    like: s.likedCnt ?? s.likeCnt ?? s.like ?? fallback.like ?? 0,
    fav: s.collectCnt ?? s.fav ?? fallback.fav ?? 0,
  }
}
