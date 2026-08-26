import { ref } from 'vue'

export const toasts = ref([])

let seq = 0

export function showToast(message, duration = 2000) {
  if (!message) return
  const id = ++seq
  toasts.value = [...toasts.value, { id, message }]
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, duration)
}

export async function copyText(text) {
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(String(text))
      return true
    }
  } catch {}
  // clipboard API needs a secure context; fall back to a detached textarea.
  try {
    const el = document.createElement('textarea')
    el.value = String(text)
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
