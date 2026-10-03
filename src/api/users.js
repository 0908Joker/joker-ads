import { apiFetch } from './client.js'

export async function fetchUserInfo() {
  return { unavailable: true }
}

export async function fetchUserSignin() {
  throw new Error('本地客户签到尚未接入，未领取任何奖励')
}

export async function fetchActionStats() {
  return { commentCount: '—', downloadCount: '—', aiCreateCount: '—' }
}
