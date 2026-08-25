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
  return {
    id: v.id,
    title: v.name || v.title || '',
    // Full stream when entitled, otherwise the trial playlist; both are m3u8.
    playUrl: data.url || data.previewUrl || '',
    isPreview: !data.url && !!data.previewUrl,
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

export function normalizeComic(item) {
  if (!item) return null
  const title = item.name || item.title || ''
  if (!title) return null
  return {
    title,
    type: item.categoryName || item.tags?.[0] || item.type || '韩漫',
    status: item.schedule || (item.updateStatus === 1 ? '完结' : '连载'),
    cover: mediaUrl(item.coverURL || item.horizontalCoverUrl || item.cover),
    coverLocal: item.coverLocal || '',
  }
}

export function normalizeUser(data, fallback = {}) {
  const u = data?.userInfo || data?.user || data || {}
  return {
    id: u.uid || u.id || fallback.id || '',
    name: u.nickName || u.name || fallback.name || '游客',
    bio: u.introduction || u.bio || fallback.bio || '这家伙很懒，什么也没有留下…',
  }
}

export function normalizeStats(data, fallback = {}) {
  const s = data?.actionStats || data || {}
  return {
    follow: s.followCnt ?? s.follow ?? fallback.follow ?? 0,
    like: s.likeCnt ?? s.like ?? fallback.like ?? 0,
    fav: s.collectCnt ?? s.fav ?? fallback.fav ?? 0,
  }
}
