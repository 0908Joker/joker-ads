import { apiFetch, refreshApiSid } from './client.js'

export async function fetchVipPackages() {
  await refreshApiSid()
  const raw = await apiFetch('/user/vipTypeCfg')
  const data = raw.data ?? raw
  const list = data?.msg || data?.list || (Array.isArray(data) ? data : [])
  return list.filter((x) => x?.bEnable !== false && x?.name)
}

export async function fetchGoldPackages() {
  await refreshApiSid()
  const raw = await apiFetch('/recharge/payEnforce/getRechargeCfg')
  const data = raw.data ?? raw
  return Array.isArray(data) ? data.filter((x) => x?.goldAmount != null) : []
}
