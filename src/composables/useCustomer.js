import { reactive, readonly } from 'vue'
import { fetchJsonTimed } from '../api/timedFetch.js'

const FP_KEY = 'dw_device_fp'
const TOKEN_KEY = 'dw_card_token'
const SHOWN_KEY = 'dw_card_shown'
let claimInFlight = null
let refreshInFlight = null

export const customerState = reactive({
  ready: false,
  customerId: '',
  cardNo: '',
  inviteCode: '',
  invitedBy: '',
  inviteCount: 0,
  isNew: false,
  error: '',
})

export function inviteCodeFromLocation() {
  try {
    const q = new URLSearchParams(location.search)
    if (q.get('inviteCode')) return q.get('inviteCode')
    const hash = String(location.hash || '')
    const i = hash.indexOf('?')
    if (i >= 0) return new URLSearchParams(hash.slice(i)).get('inviteCode') || ''
  } catch {}
  return ''
}

export function dewuInviteUrl(inviteCode) {
  const code = inviteCode || customerState.inviteCode
  const base = 'http://okqpkdj.cn/'
  return code ? `${base}?inviteCode=${encodeURIComponent(code)}` : base
}

function newDeviceFp() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `fp_${crypto.randomUUID().replace(/-/g, '')}`
    }
  } catch {}
  return `fp_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

function deviceFp() {
  let fp = ''
  try {
    fp = localStorage.getItem(FP_KEY) || ''
  } catch {}
  if (!fp || fp.length < 8) {
    fp = newDeviceFp()
    try {
      localStorage.setItem(FP_KEY, fp)
    } catch {}
  }
  return fp
}

export async function claimCustomer() {
  if (claimInFlight) return claimInFlight
  claimInFlight = (async () => {
  try {
    const body = {
      deviceFp: deviceFp(),
      inviteCode: inviteCodeFromLocation(),
    }
    try {
      body.cardToken = localStorage.getItem(TOKEN_KEY) || ''
    } catch {}
    const data = await fetchJsonTimed('/api/public/customers/claim', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    applyCustomerResult(data)
    customerState.isNew = !!data.isNew
    customerState.error = ''
    if (data.token) {
      try {
        localStorage.setItem(TOKEN_KEY, data.token)
      } catch {}
    }
    return readonly(customerState)
  } catch (e) {
    customerState.error = e.message || '签发失败'
    return readonly(customerState)
  } finally {
    customerState.ready = true
  }
  })().finally(() => { claimInFlight = null })
  return claimInFlight
}

export function applyCustomerResult(data) {
  if (!data?.customerId || !data?.cardNo || !data?.inviteCode) throw new Error('客户信息响应不完整')
  if (customerState.customerId && customerState.customerId !== data.customerId) throw new Error('身份不一致，已保留原身份卡')
  if (customerState.cardNo && customerState.cardNo !== data.cardNo) throw new Error('身份不一致，已保留原身份卡')
  customerState.customerId = data.customerId
  customerState.cardNo = data.cardNo
  customerState.inviteCode = data.inviteCode
  customerState.invitedBy = data.invitedBy || ''
  customerState.inviteCount = Number(data.inviteCount || 0)
  customerState.error = ''
  customerState.ready = true
}

export async function refreshCustomer() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    if (claimInFlight) await claimInFlight
    try {
      const data = await fetchJsonTimed('/api/public/customers/me', { credentials: 'include' })
      applyCustomerResult(data)
      return readonly(customerState)
    } catch (error) {
      if (![401, 404].includes(error.status)) throw error
      let fp = ''
      try { fp = localStorage.getItem('dw_device_fp') || '' } catch {}
      if (customerState.customerId && fp.length < 8) throw new Error('身份凭据不可用，已保留原身份卡')
      await claimCustomer()
      if (customerState.error) throw new Error(customerState.error)
      return readonly(customerState)
    }
  })().finally(() => { refreshInFlight = null })
  return refreshInFlight
}

export function shouldAutoShowCard() {
  if (!customerState.isNew || !customerState.cardNo) return false
  try {
    if (localStorage.getItem(SHOWN_KEY) === customerState.cardNo) return false
  } catch {}
  return true
}

export function markCardShown() {
  try {
    if (customerState.cardNo) localStorage.setItem(SHOWN_KEY, customerState.cardNo)
  } catch {}
}

export function useCustomer() {
  return customerState
}
