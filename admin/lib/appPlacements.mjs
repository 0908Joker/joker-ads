// AppCenter resolves app names through these lists, not config.apps directly.
export function addAppPlacement(config, name) {
  const placements = config.categoryApps ||= {}
  const categories = placements.byCategory ||= {}
  const names = categories['官方推荐'] ||= []
  if (!names.includes(name)) names.unshift(name)
  // Empty/missing mode lists mean "all apps"; keep that behavior intact.
  for (const list of [
    placements.modes?.['站长推荐'],
    placements.modes?.['热门下载'],
    placements.modesByCategory?.['官方推荐']?.['站长推荐'],
  ]) {
    if (Array.isArray(list) && list.length && !list.includes(name)) list.unshift(name)
  }
}

export function updateAppPlacements(config, oldName, nextName = null) {
  const placements = config.categoryApps || {}
  const groups = [placements.byCategory, placements.modes, ...Object.values(placements.modesByCategory || {})]
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue
    for (const [key, names] of Object.entries(group)) {
      if (!Array.isArray(names)) continue
      group[key] = [...new Set(names.flatMap(name => name === oldName ? (nextName === null ? [] : [nextName]) : [name]))]
    }
  }
}
