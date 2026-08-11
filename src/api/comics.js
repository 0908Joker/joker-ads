import { apiFetch } from './client.js'

export async function fetchHomeComic(params = {}) {
  const q = new URLSearchParams(params)
  return apiFetch(`/comics/getHomeComic?${q}`)
}

export async function fetchComicCategories() {
  return apiFetch('/comics/getComicCategories')
}

export async function fetchComicTags() {
  return apiFetch('/comics/getTags')
}
