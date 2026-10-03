// The session owns every attempt; stale callbacks cannot affect the next session.
export function createPlaybackSession({ getVideo, getSequence, loadHls, proxy = value => value, timeoutMs = 10000, onError = () => {} }) {
  let session = null
  function disposeAttempt(attempt) {
    if (!attempt || attempt.disposed) return
    attempt.disposed = true
    attempt.cancel?.()
    attempt.cleanup?.()
    try { attempt.hls?.destroy() } catch {}
    try { attempt.el.pause(); attempt.el.removeAttribute('src'); attempt.el.load() } catch {}
  }
  function dispose() {
    const previous = session
    session = null
    if (previous) { previous.cancelled = true; disposeAttempt(previous.attempt) }
  }
  const current = owner => session === owner && !owner.cancelled && getSequence() === owner.seq
  async function attemptSource(owner, url) {
    if (!current(owner)) return false
    disposeAttempt(owner.attempt)
    const el = getVideo()
    if (!el) return false
    const attempt = { el, disposed: false, hls: null }
    owner.attempt = attempt
    let settled = false, readyReached = false, timer
    let resolveReady
    const ready = new Promise(resolve => { resolveReady = resolve })
    const valid = () => current(owner) && owner.attempt === attempt && !attempt.disposed
    const finish = value => { if (!settled) { settled = true; clearTimeout(timer); resolveReady(value) } }
    const loaded = () => {
      if (!valid() || el.readyState < 2) return
      readyReached = true
      finish(true)
    }
    const failed = () => {
      if (!valid()) return
      if (!readyReached) finish(false)
      else {
        // Detach the failed attempt before another fatal event can start a second fallback.
        disposeAttempt(attempt)
        if (!owner.advancing) void advance(owner)
      }
    }
    attempt.cancel = () => finish(false)
    attempt.cleanup = () => {
      clearTimeout(timer)
      el.removeEventListener('loadeddata', loaded)
      el.removeEventListener('canplay', loaded)
      el.removeEventListener('error', failed)
      if (attempt.hls) attempt.hls.off(attempt.events.ERROR, attempt.error)
    }
    el.addEventListener('loadeddata', loaded)
    el.addEventListener('canplay', loaded)
    el.addEventListener('error', failed)
    timer = setTimeout(() => finish(false), timeoutMs)
    const initialize = async () => {
      if (/\.m3u8(\?|$)/i.test(url)) {
        const { default: Hls } = await loadHls()
        if (!valid()) return
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true })
          attempt.hls = hls; attempt.events = Hls.Events
          attempt.error = (_event, data) => { if (data.fatal) failed() }
          hls.on(Hls.Events.ERROR, attempt.error)
          hls.loadSource(url)
          hls.attachMedia(el)
          return
        }
        if (!el.canPlayType('application/vnd.apple.mpegurl')) { failed(); return }
      }
      if (!valid()) return
      el.src = url
      el.load()
    }
    void initialize().catch(failed)
    const ok = await ready
    if (!valid()) return false
    if (!ok) { disposeAttempt(attempt); return false }
    // Error listeners stay installed until disposal, including after the first frame.
    try { Promise.resolve(el.play()).catch(() => {}) } catch {}
    return true
  }
  async function advance(owner) {
    owner.advancing = true
    try {
    while (current(owner) && owner.next < owner.urls.length) {
      const url = owner.urls[owner.next++]
      if (await attemptSource(owner, proxy(url))) {
        if (!owner.attempt.disposed) return current(owner)
      }
    }
    if (current(owner)) onError(new Error('视频加载失败，请稍后重试'))
    return false
    } finally { owner.advancing = false }
  }
  async function attachCandidates(urls, seq) {
    if (seq !== getSequence()) return false
    dispose()
    const owner = { seq, urls: [...new Set((urls || []).filter(Boolean))], next: 0, cancelled: false, attempt: null }
    session = owner
    return advance(owner)
  }
  return { attachCandidates, dispose }
}
