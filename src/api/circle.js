import { apiFetch } from './client.js'

export async function fetchCircleVoting(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '10', ...params })
  return apiFetch(`/circle/getAllCircleVoting?${q}`)
}

export async function fetchCircleRank(params = {}) {
  const q = new URLSearchParams({ page: '1', pageSize: '20', ...params })
  return apiFetch(`/circle/getCircleRankList?${q}`)
}

/** Origin circle home: moduleCHJ({ type:'basic', index, compositeSort, page, pageSize }) */
export async function fetchCircleModule(params = {}) {
  const q = new URLSearchParams({
    page: '1',
    pageSize: '10',
    type: 'basic',
    index: '0',
    compositeSort: '4',
    ...params,
  })
  return apiFetch(`/circle/moduleCHJ?${q}`)
}
