export async function withRequestDeadline(operation, timeoutMs = 15000, signal) {
  const controller = new AbortController()
  let timer, rejectCancelled
  const stopped = new Promise((_, reject) => { rejectCancelled = reject })
  const cancel = () => {
    controller.abort()
    const error = new Error('请求已取消')
    error.name = 'AbortError'
    rejectCancelled(error)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  timer = setTimeout(() => { controller.abort(); rejectCancelled(new Error('请求超时，请重试')) }, timeoutMs)
  try {
    if (signal?.aborted) cancel()
    return await Promise.race([stopped, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('请求已取消')
      return operation(controller.signal)
    })])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}

export async function fetchJsonTimed(url, options = {}, timeoutMs = 5000) {
  return withRequestDeadline(async signal => {
    const response = await fetch(url, { ...options, signal })
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status })
    return response.json()
  }, timeoutMs, options.signal)
}
