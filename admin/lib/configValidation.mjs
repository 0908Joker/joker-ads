function invalid(field, expected) {
  throw Object.assign(new Error(`${field}: ${expected}`), { status: 400, field })
}
function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field, '必须是对象')
}
function strings(value, field) {
  if (!Array.isArray(value) || value.some(x => typeof x !== 'string')) invalid(field, '必须是字符串数组')
}
function item(value, field, named = false) {
  object(value, field)
  if (named && (typeof value.name !== 'string' || !value.name.trim())) invalid(field + '.name', '应用名称不能为空')
  for (const key of ['name', 'url', 'orgUrl', 'signUrl', 'icon', 'iconLocal', 'image', 'coverUrl', 'title', 'subtitle', 'btn', 'tag', 'text']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') invalid(field + '.' + key, '必须是字符串')
  }
}
function items(value, field, named = false) {
  if (!Array.isArray(value)) invalid(field, '必须是数组')
  value.forEach((v, i) => item(v, `${field}[${i}]`, named))
}
export function validatePart(part, value) {
  object(value, part)
  if (part === 'config') {
    items(value.apps, 'config.apps', true)
    if (value.modes !== undefined) {
      if (!Array.isArray(value.modes)) invalid('config.modes', '必须是数组')
      value.modes.forEach((mode, i) => {
        object(mode, `config.modes[${i}]`)
        for (const key of ['id', 'label']) if (typeof mode[key] !== 'string') invalid(`config.modes[${i}].${key}`, '必须是字符串')
      })
    }
    if (value.categories !== undefined) strings(value.categories, 'config.categories')
    if (value.popups !== undefined) items(value.popups, 'config.popups')
    for (const key of ['promo', 'floatBanner']) if (value[key] !== undefined) item(value[key], 'config.' + key)
    if (value.categoryApps !== undefined) {
      object(value.categoryApps, 'config.categoryApps')
      for (const key of ['byCategory', 'modes']) if (value.categoryApps[key] !== undefined) {
        object(value.categoryApps[key], 'config.categoryApps.' + key)
        for (const [k, v] of Object.entries(value.categoryApps[key])) strings(v, `config.categoryApps.${key}.${k}`)
      }
      if (value.categoryApps.modesByCategory !== undefined) {
        object(value.categoryApps.modesByCategory, 'config.categoryApps.modesByCategory')
        for (const [key, mapping] of Object.entries(value.categoryApps.modesByCategory)) {
          object(mapping, 'config.categoryApps.modesByCategory.' + key)
          for (const [mode, list] of Object.entries(mapping)) strings(list, `config.categoryApps.modesByCategory.${key}.${mode}`)
        }
      }
    }
  } else if (part === 'popups') {
    for (const key of ['afterEnterApp', 'gridPopAds', 'actPopAds']) if (value[key] !== undefined) items(value[key], 'popups.' + key)
  } else if (part === 'tabs') {
    for (const key of ['mine', 'featured']) if (value[key] !== undefined) object(value[key], 'tabs.' + key)
    if (value.mine?.quickApps !== undefined) items(value.mine.quickApps, 'tabs.mine.quickApps', true)
    if (value.featured?.ad !== undefined) item(value.featured.ad, 'tabs.featured.ad')
    if (value.featured?.subTabs !== undefined) strings(value.featured.subTabs, 'tabs.featured.subTabs')
  }
  return value
}
export function validatePublished(bundle) {
  object(bundle, 'bundle')
  for (const part of ['config', 'popups', 'tabs']) validatePart(part, bundle[part])
  object(bundle.apiSession, 'apiSession')
  object(bundle.meta, 'meta')
  if (!Number.isSafeInteger(bundle.meta.version) || bundle.meta.version < 0) invalid('meta.version', '必须是非负整数')
  return bundle
}
