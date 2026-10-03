import { apiFetch } from './client.js'

export async function fetchRecommend(params = {}, options = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '20', ...params })
  return apiFetch(`/videos/recommend?${q}`, options)
}

export async function fetchAlgoRecommendList(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '20', ...params })
  return apiFetch(`/algoRecommend/getList?${q}`)
}

/** Origin featured tabs: getSecondCategoriesData → categories/{categoryId} */
export async function fetchCategoryVideos(categoryId, params = {}) {
  const q = new URLSearchParams({
    page: '1',
    pageSize: '20',
    timeType: '1',
    compositeSort: '1',
    inPool: 'true',
    ...params,
  })
  return apiFetch(`/categories/${categoryId}?${q}`)
}

export async function fetchVideoFilter(params = {}) {
  const q = new URLSearchParams(params)
  return apiFetch(`/videos/filter?${q}`)
}

export async function fetchTagVideos(tag, params = {}) {
  const q = new URLSearchParams({ tag, page: '1', pageSize: '20', ...params })
  return apiFetch(`/tag/videos?${q}`)
}

export async function fetchTagVideosByName(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '20', ...params })
  return apiFetch(`/tag/videos/name?${q}`)
}

export async function fetchShortCate() {
  return apiFetch('/videos/shortCate')
}

export async function fetchShortAndImg(params = {}, options = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '10', ...params })
  return apiFetch(`/videos/shortAndImg?${q}`, options)
}

export async function fetchShortByCategorie(params = {}, options = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '10', ...params })
  return apiFetch(`/videos/short?${q}`, options)
}

export async function fetchVideoDetail(id, options = {}) {
  return apiFetch(`/videos/${id}`, options)
}

export async function fetchShortVideos(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '10', ...params })
  return apiFetch(`/videos/short?${q}`)
}
