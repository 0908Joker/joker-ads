import { apiFetch } from './client.js'

export async function fetchCircleVoting() {
  return apiFetch('/circle/getAllCircleVoting')
}

export async function fetchCircleRank() {
  return apiFetch('/circle/getCircleRankList?page=1&pageSize=20')
}
