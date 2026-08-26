import { apiFetch } from './client.js'

export async function fetchWelfareConfig() {
  const raw = await apiFetch('/activity/welfareConfig')
  const list = raw.data ?? raw
  return Array.isArray(list) ? list.filter((x) => x?.active && x?.name) : []
}
