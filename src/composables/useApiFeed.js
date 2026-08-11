import { ref, watch } from 'vue'
import { apiFetch, getLastFetchAt } from '../api/client.js'
import { unwrapApiPayload } from '../api/decrypt.js'

export function useApiFeed({ fetcher, normalize, fallback = [], watchKeys = [] }) {
  const items = ref([...fallback])
  const loading = ref(false)
  const live = ref(false)
  const error = ref('')

  async function load(extra = {}) {
    loading.value = true
    error.value = ''
    try {
      const raw = await fetcher(extra)
      const data = unwrapApiPayload(raw) ?? raw?.data ?? raw
      const list = normalize(data)
      if (list?.length) {
        items.value = list
        live.value = true
      }
    } catch (e) {
      error.value = String(e.message || e)
      if (!items.value.length && fallback.length) items.value = [...fallback]
    } finally {
      loading.value = false
    }
  }

  if (watchKeys.length) {
    watch(watchKeys, () => load(), { immediate: true })
  } else {
    load()
  }

  return { items, loading, live, error, reload: load, lastFetchAt: getLastFetchAt }
}

export function cleanFeedList(list, minTitle = 6) {
  return (list || [])
    .map((v) => ({
      ...v,
      title: v.title?.replace(/\s+/g, ' ').trim(),
    }))
    .filter((v) => v.title && v.title.length >= minTitle && !/快速筛选|广告 SQ|^\d/.test(v.title))
}
