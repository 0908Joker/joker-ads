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
    id: item.id || '',
    title,
    type: item.categoryName || item.tags?.[0]?.name || item.tags?.[0] || item.type || '韩漫',
    status: item.schedule || (item.updateStatus === 1 ? '完结' : '连载'),
    cover: mediaUrl(item.coverURL || item.horizontalCoverUrl || item.cover),
    coverLocal: item.coverLocal || '',
  }
}

export function mapComicSectionTitle(flagName) {
  if (flagName === '最近更新') return '更新预告'
  if (flagName === '连载中') return '韩漫'
  if (flagName === '已完结') return '同人'
  return flagName || '漫画'
}

export function normalizeCircleVoting(item, fallback = {}) {
  if (!item) return null
  const title =
    item.circleVotingTitle || item.title || item.name || item.content || fallback.title || ''
  if (!title) return null
  const aff = Number(item.affirmativeVotes ?? item.agreeCnt ?? 0)
  const neg = Number(item.negativeVotes ?? item.opposeCnt ?? 0)
  const total = aff + neg
  const proRaw = item.agreeRate ?? item.proRate ?? item.pro ?? fallback.pro
  const conRaw = item.opposeRate ?? item.conRate ?? item.con ?? fallback.con
  const toPct = (v) => {
    if (v == null || v === '') return ''
    if (typeof v === 'string' && v.includes('%')) return v
    const n = Number(v)
    if (!Number.isFinite(n)) return ''
    return n <= 1 ? `${(n * 100).toFixed(2)}%` : `${n.toFixed(2)}%`
  }
  const proFromVotes = total > 0 ? `${((aff / total) * 100).toFixed(2)}%` : ''
  const conFromVotes = total > 0 ? `${((neg / total) * 100).toFixed(2)}%` : ''
  return {
    title,
    participants:
      total ||
      (item.joinCnt ?? item.participants ?? item.peopleCnt ?? fallback.participants ?? 0),
    pro: proFromVotes || toPct(proRaw) || fallback.pro || '50%',
    con: conFromVotes || toPct(conRaw) || fallback.con || '50%',
    issue: item.issueNumber || item.issue || item.period || item.期数 || fallback.issue || '',
    cover: mediaUrl(item.backgroundURL || item.coverURL || item.cover || item.bgUrl || ''),
    id: item.id || item.circleId || '',
  }
}

export function normalizeCircleGroup(item, index = 0) {
  if (!item) return null
  const name = item.name || item.title || item.tagName || ''
  if (!name) return null
  const count = item.circleCnt ?? item.circlesCnt ?? item.postCnt ?? item.count ?? item.newsCnt
  return {
    id: item.id || item.tagId || item.cateId || `circle-${index}`,
    name,
    count: typeof count === 'string' && /帖子/.test(count)
      ? count
      : `${formatCount(count ?? 0)}个帖子`,
    cover: mediaUrl(item.coverUrl || item.coverURL || item.avatarURL || item.iconURL || item.cover || ''),
  }
}

export function normalizeCirclePost(item) {
  if (!item) return null
  const title = item.title || item.circleContent?.[0]?.content || item.content || item.name || item.desc || ''
  if (!title || title.length < 2) return null
  const user =
    item.publisherName ||
    item.user?.username ||
    item.user?.nickName ||
    item.username ||
    item.nickName ||
    '小红书用户'
  const tags = item.tags || item.circleTags || []
  const tag =
    item.tagName ||
    item.circleName ||
    (Array.isArray(tags) ? (typeof tags[0] === 'string' ? tags[0] : tags[0]?.name) : '') ||
    ''
  const release = item.releaseDate || item.createdAt || ''
  const timeLabel =
    item.releaseDateLabel ||
    item.time ||
    (release ? String(release).slice(0, 10) : '')
  return {
    id: item.id || item.newsId || item.circleId || '',
    user: user.startsWith('@') ? user.slice(1) : user,
    time: timeLabel,
    title: String(title).startsWith('web/') ? item.title || '' : title,
    tag: tag ? (String(tag).startsWith('#') ? tag : `#${tag}`) : '',
    pinned: !!(item.bPinToTop || item.bPinToTopForPlatform || item.isTop || item.pinned || item.top),
    likes: item.likedCnt ?? item.likes ?? item.likeCnt ?? 0,
    comments: item.totoalCommentCnt ?? item.commentCnt ?? item.comments ?? 0,
    views: formatCount(item.playCnt ?? item.viewCnt ?? item.hot ?? item.views ?? 0),
    images: (() => {
      const coverRaw = item.coverUrl || item.coverURL
      const raw = item.imgUrls || item.images || (coverRaw ? (Array.isArray(coverRaw) ? coverRaw : [coverRaw]) : [])
      return (Array.isArray(raw) ? raw : [])
        .filter(Boolean)
        .map((p) => mediaUrl(p))
        .slice(0, 3)
    })(),
  }
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

export function normalizeStats(data, fallback = {}) {
  const s = data?.actionStats || data || {}
  return {
    follow: s.followCnt ?? s.follow ?? fallback.follow ?? 0,
    like: s.likeCnt ?? s.like ?? fallback.like ?? 0,
    fav: s.collectCnt ?? s.fav ?? fallback.fav ?? 0,
  }
}
