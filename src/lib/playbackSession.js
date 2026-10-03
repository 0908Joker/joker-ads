// Each attempt owns its player, listeners and timer; stale tasks cannot clean up a newer one.
export function createPlaybackSession({ getVideo, getSequence, loadHls, proxy = value => value, timeoutMs = 10000 }) {
  let active = null
  const current = (attempt, seq) => active === attempt && getSequence() === seq && !attempt.cancelled
  function dispose(attempt = active) {
    if (!attempt || attempt.disposed) return
    attempt.disposed = true
    attempt.cancelled = true
    attempt.cancel?.()
    attempt.cleanup?.()
    try { attempt.hls?.destroy() } catch {}
    if (active !== attempt) return
    active = null
    try { attempt.el.pause(); attempt.el.removeAttribute('src'); attempt.el.load() } catch {}
  }
  async function attach(url, seq) {
    if (seq !== getSequence()) return false
    dispose()
    const el = getVideo()
    if (!el || !url) return false
    const attempt = { el, hls: null, cancelled: false }
    active = attempt
    let timer
    const listeners = []
    let rejectWait, resolveWait
    const ready = new Promise((resolve, reject) => { resolveWait = resolve; rejectWait = reject })
    const clean = () => {
      clearTimeout(timer)
      for (const [name, listener] of listeners) el.removeEventListener(name, listener)
      listeners.length = 0
      if (attempt.hls) {
        attempt.hls.off(attempt.events.MANIFEST_PARSED, attempt.ok)
        attempt.hls.off(attempt.events.ERROR, attempt.error)
      }
    }
    attempt.cleanup = clean
    attempt.cancel = () => rejectWait(new Error('cancelled'))
    timer = setTimeout(() => rejectWait(new Error('media timeout')), timeoutMs)
    const native = () => {
      const ok = () => resolveWait(), error = () => rejectWait(new Error('media error'))
      listeners.push(['loadeddata', ok], ['error', error])
      el.addEventListener('loadeddata', ok, { once: true })
      el.addEventListener('error', error, { once: true })
      el.src = url
      el.load()
    }
    const initialize = async () => {
      if (!/\.m3u8(\?|$)/i.test(url)) { native(); return }
      const { default: Hls } = await loadHls()
      if (!current(attempt, seq)) return
      if (Hls.isSupported()) {
        const own = new Hls({ enableWorker: true })
        attempt.hls = own; attempt.events = Hls.Events
        attempt.ok = () => resolveWait()
        attempt.error = (_event, data) => { if (data.fatal) rejectWait(new Error('hls fatal')) }
        own.on(Hls.Events.MANIFEST_PARSED, attempt.ok)
        own.on(Hls.Events.ERROR, attempt.error)
        own.loadSource(url)
        own.attachMedia(el)
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) native()
      else throw new Error('unsupported')
    }
    // The timer also bounds a stalled dynamic import.
    void initialize().catch(rejectWait)
    try {
      await ready
      if (!current(attempt, seq)) return false
      clean()
      // Autoplay permission must not stall candidate completion.
      try { Promise.resolve(el.play()).catch(() => {}) } catch {}
      return true
    } catch {
      dispose(attempt)
      return false
    } finally { clean() }
  }
  async function attachCandidates(urls, seq) {
    for (const raw of (urls || []).filter(Boolean)) {
      if (seq !== getSequence()) return false
      if (await attach(proxy(raw), seq)) return seq === getSequence()
      if (seq !== getSequence()) return false
    }
    return false
  }
  return { attachCandidates, dispose }
}
