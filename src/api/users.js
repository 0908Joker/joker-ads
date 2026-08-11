import { apiFetch } from './client.js'

export async function fetchUserInfo() {
  return apiFetch('/users/info')
}

export async function fetchUserSignin() {
  return apiFetch('/users/signin', { method: 'POST' })
}

export async function fetchActionStats() {
  return apiFetch('/users/actionStats')
}
