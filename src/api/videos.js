import { apiFetch } from './client.js'

export async function fetchRecommend(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '20', ...params })
  return apiFetch(`/videos/recommend?${q}`)
}

export async function fetchVideoFilter(params = {}) {
  const q = new URLSearchParams(params)
  return apiFetch(`/videos/filter?${q}`)
}

export async function fetchTagVideos(tag, params = {}) {
  const q = new URLSearchParams({ tag, page: '1', pageSize: '20', ...params })
  return apiFetch(`/tag/videos?${q}`)
}

export async function fetchShortAndImg(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '10', ...params })
  return apiFetch(`/videos/shortAndImg?${q}`)
}

export async function fetchShortVideos(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '10', ...params })
  return apiFetch(`/videos/short?${q}`)
}
