import { apiFetch } from './client.js'

export async function fetchHomeComic(params = {}) {
  const q = new URLSearchParams(params)
  return apiFetch(`/comics/getHomeComic?${q}`)
}

export async function fetchHomeComicSuper() {
  return apiFetch('/comics/getHomeComic_super')
}

/** Origin section pagination: comics/getComicList/{sectionId} */
export async function fetchComicList(sectionId, params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '10', isMore: 'false', ...params })
  return apiFetch(`/comics/getComicList/${sectionId}?${q}`)
}

/** Origin date-strip preview: comics/getPreviewComics/{id}?searchDate=YYYY-MM-DD */
export async function fetchPreviewComics(previewId, params = {}) {
  const q = new URLSearchParams({ page: '1', ...params })
  return apiFetch(`/comics/getPreviewComics/${previewId}?${q}`)
}

export async function fetchComicCategories() {
  return apiFetch('/comics/getComicCategories')
}

export async function fetchComicTags() {
  return apiFetch('/comics/getTags')
}
