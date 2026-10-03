export async function fetchJsonTimed(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController()
  let timer
  try {
    return await Promise.race([
      fetch(url, { ...options, signal: controller.signal }).then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('请求超时，请重试')) }, timeoutMs) }),
    ])
  } finally { clearTimeout(timer) }
}
