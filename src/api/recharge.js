import { apiFetch } from './client.js'

export async function fetchVipCommodity() {
  return apiFetch('/recharge/commodity')
}

export async function fetchGoldCommodity() {
  return apiFetch('/recharge/gold')
}

export async function fetchPayTypes() {
  return apiFetch('/recharge/payEnforce/getRechargeCfg')
}

export async function createVipOrder(body) {
  return apiFetch('/recharge/createOrder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function createGoldOrder(body) {
  return apiFetch('/recharge/rechargeGold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
