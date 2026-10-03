const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

let user = null
let bundle = null
let currentPage = 'dashboard'
let appsPage = 1
let appsQuery = ''

const NAV = [
  { id: 'dashboard', label: '控制台', read: 'dashboard' },
  { id: 'popups', label: '进站弹窗', read: 'popups' },
  { id: 'grid', label: '网格弹窗', read: 'popups' },
  { id: 'promo', label: '顶部促销', read: 'promo' },
  { id: 'float', label: '悬浮条', read: 'float' },
  { id: 'apps', label: '应用列表', read: 'apps' },
  { id: 'categories', label: '分类映射', read: 'categories' },
  { id: 'featured', label: '精选广告', read: 'tabs' },
  { id: 'mine', label: '我的页应用', read: 'tabs' },
  { id: 'customers', label: '客户身份卡', read: 'customers' },
  { id: 'stats', label: '点击统计', read: 'stats' },
  { id: 'logs', label: '操作日志', read: 'logs' },
  { id: 'security', label: '安全设置', read: 'settings' },
  { id: 'api-session', label: '原站 Token', read: 'settings', superOnly: true },
]

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

function toast(msg) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2200)
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function canWrite(scope) {
  if (!user) return false
  if (user.role === 'readonly') return false
  return user.role === 'super' || user.role === 'ad_admin'
}

function showLogin() {
  $('#login-screen').style.display = 'flex'
  $('#admin-screen').style.display = 'none'
}

function showAdmin() {
  $('#login-screen').style.display = 'none'
  $('#admin-screen').style.display = 'flex'
  $('#admin-screen').style.flexDirection = 'column'
  $('#user-badge').textContent = `${user.username} (${user.role})`
  renderSidebar()
  renderPage(currentPage)
}

async function login() {
  $('#login-err').textContent = ''
  try {
    const body = {
      username: $('#login-user').value.trim(),
      password: $('#login-pass').value,
    }
    if ($('#login-totp').style.display !== 'none') body.totp = $('#login-totp').value.trim()
    const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify(body) })
    user = data.user
    if (user.mustChangePassword) return openPasswordModal({ required: true })
    await loadBundle()
    showAdmin()
    if (user.mustChangePassword) openPasswordModal({ required: true })
  } catch (e) {
    if (e.message.includes('动态验证码')) {
      $('#login-totp').style.display = 'block'
    }
    $('#login-err').textContent = e.message
  }
}

async function logout() {
  try { await api('/api/admin/logout', { method: 'POST', body: '{}' }) } catch {}
  user = null
  showLogin()
}

async function loadBundle() {
  bundle = await api('/api/admin/site-config')
  $('#version-badge').textContent = `draft · v${bundle.meta?.version || 1}`
}

async function publish() {
  if (!canWrite('publish')) return toast('无发布权限')
  if (!confirm('确认将当前草稿发布到前台？')) return
  const data = await api('/api/admin/publish', { method: 'POST', body: '{}' })
  toast(`已发布 v${data.meta.version}`)
  await loadBundle()
}

function renderSidebar() {
  const items = NAV.filter((n) => !n.superOnly || user?.role === 'super')
  $('#sidebar').innerHTML = items.map((n) =>
    `<div class="nav-item ${currentPage === n.id ? 'active' : ''}" data-page="${n.id}"><span class="nav-dot"></span>${esc(n.label)}</div>`,
  ).join('')
  $$('#sidebar .nav-item').forEach((el) => {
    el.onclick = () => { currentPage = el.dataset.page; renderSidebar(); renderPage(currentPage) }
  })
}

function renderPage(page) {
  const main = $('#main')
  if (page === 'dashboard') return renderDashboard(main)
  if (page === 'popups') return renderListEditor(main, 'afterEnterApp', '进站弹窗队列')
  if (page === 'grid') return renderListEditor(main, 'gridPopAds', '网格弹窗（精品APP）')
  if (page === 'promo') return renderObjectEditor(main, 'promo', '顶部促销条', ['tag', 'text', 'image', 'url', 'signUrl'])
  if (page === 'float') return renderObjectEditor(main, 'floatBanner', '悬浮条', ['title', 'subtitle', 'url', 'signUrl', 'btn'])
  if (page === 'apps') return renderApps(main)
  if (page === 'categories') return renderCategories(main)
  if (page === 'featured') return renderObjectEditor(main, 'featuredAd', '精选内嵌广告', ['name', 'viewers', 'url', 'signUrl'])
  if (page === 'mine') return renderListEditor(main, 'mineQuickApps', '我的页快捷应用')
  if (page === 'customers') return renderCustomers(main)
  if (page === 'stats') return renderStats(main)
  if (page === 'logs') return renderLogs(main)
  if (page === 'security') return renderSecurity(main)
  if (page === 'api-session') return renderApiSession(main)
  main.innerHTML = '<div class="card">页面开发中</div>'
}

async function renderDashboard(main) {
  const dash = await api('/api/admin/dashboard')
  main.innerHTML = `
    <div class="page-header"><span class="page-title">控制台</span></div>
    <div class="metric-grid">
      ${metric('应用数', dash.stats.apps, '#f81942')}
      ${metric('进站弹窗', dash.stats.popups, '#2a9d8f')}
      ${metric('网格弹窗', dash.stats.gridPopups, '#7ab3e0')}
      ${metric('今日点击', dash.stats.clicksToday, '#e9c46a')}
      ${metric('客户卡', dash.stats.customersTotal || 0, '#00c8e8')}
      ${metric('累计点击', dash.stats.clicksTotal, '#888')}
      ${metric('线上版本', dash.stats.version, '#aaa')}
    </div>
    <div class="notice">编辑各模块后点击右上角「发布到前台」，用户刷新站点即可看到更新。草稿不会立即影响线上。</div>
    <div class="card"><div style="font-weight:700;margin-bottom:12px;">最近操作</div>
      <table><thead><tr><th>操作人</th><th>动作</th><th>时间</th></tr></thead><tbody>
      ${(dash.logs || []).map((l) => `<tr><td>${esc(l.admin_name)}</td><td>${esc(l.action)}</td><td>${esc(l.created_at?.slice(0, 19))}</td></tr>`).join('') || '<tr><td colspan="3" class="empty-row">暂无日志</td></tr>'}
      </tbody></table></div>`
}

function metric(label, val, color) {
  return `<div class="metric-card" style="--c:${color}"><div class="metric-label">${esc(label)}</div><div class="metric-val">${esc(val)}</div></div>`
}

function renderListEditor(main, slotKey, title) {
  const items = slotKey === 'mineQuickApps'
    ? (bundle.tabs?.mine?.quickApps || [])
    : (bundle.popups?.[slotKey] || [])
  main.innerHTML = `
    <div class="page-header"><span class="page-title">${esc(title)}</span>
      ${canWrite('popups') ? `<button class="btn btn-primary" id="add-item">新增</button>` : ''}</div>
    <div class="card" id="list-editor"></div>`
  const box = $('#list-editor')
  const render = () => {
    box.innerHTML = items.length ? items.map((item, i) => listRow(item, i, slotKey)).join('') : '<div class="empty-row">暂无条目</div>'
    bindListEvents(slotKey, items, render)
  }
  render()
  $('#add-item')?.addEventListener('click', () => {
    items.unshift({ name: '新广告', url: '', signUrl: '', coverUrl: '', image: '', icon: '' })
    render()
  })
}

function listRow(item, index, slotKey) {
  const img = item.image || item.icon || item.coverUrl || ''
  return `<div class="list-row" data-i="${index}">
    <div style="flex:1"><div class="list-title">${esc(item.name || '(未命名)')}</div>
      <div class="list-sub link-cell">${esc(item.url || '')}</div></div>
    ${img ? `<img class="img-thumb" src="${esc(img.startsWith('/') ? img : '')}" alt="" onerror="this.style.display='none'" />` : ''}
    <div class="action-btns">
      ${canWrite('popups') ? `<button class="btn btn-blue btn-sm edit">编辑</button><button class="btn btn-danger btn-sm del">删</button>` : ''}
    </div></div>`
}

function bindListEvents(slotKey, items, rerender) {
  $$('.list-row .edit').forEach((btn) => btn.onclick = async (e) => {
    const i = Number(e.target.closest('.list-row').dataset.i)
    openItemModal(slotKey, items[i], async (next) => {
      items[i] = next
      await saveSlot(slotKey, items)
      rerender()
    })
  })
  $$('.list-row .del').forEach((btn) => btn.onclick = async (e) => {
    const i = Number(e.target.closest('.list-row').dataset.i)
    if (!confirm('确认删除？')) return
    items.splice(i, 1)
    await saveSlot(slotKey, items)
    rerender()
  })
}

function renderObjectEditor(main, slotKey, title, fields) {
  const data = slotKey === 'featuredAd'
    ? (bundle.tabs?.featured?.ad || {})
    : slotKey === 'floatBanner'
      ? (bundle.config?.floatBanner || {})
      : (bundle.config?.promo || {})
  main.innerHTML = `
    <div class="page-header"><span class="page-title">${esc(title)}</span></div>
    <div class="card"><form id="obj-form">${fields.map((f) => `
      <div class="form-group"><label class="form-label">${esc(f)}</label>
        <input name="${esc(f)}" value="${esc(data[f] || '')}" ${canWrite('promo') ? '' : 'disabled'} /></div>`).join('')}
      ${canWrite('promo') ? '<button class="btn btn-primary" type="submit">保存草稿</button>' : ''}
    </form></div>`
  $('#obj-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fields.map((f) => [f, fd.get(f)]))
    await api(`/api/admin/slots/${slotKey}`, { method: 'PUT', body: JSON.stringify(body) })
    toast('已保存草稿')
    await loadBundle()
  })
}

function openItemModal(slotKey, item, onSave) {
  const fields = ['name', 'url', 'signUrl', 'coverUrl', 'image', 'icon'].filter((f) => f in item || true)
  const modal = $('#modal')
  const box = $('#modal-box')
  box.className = 'modal-box'
  box.innerHTML = `
    <div class="modal-header"><div class="modal-title">编辑条目</div><button class="modal-close" id="modal-close">×</button></div>
    ${['name', 'url', 'signUrl', 'coverUrl', 'image', 'icon'].map((f) => `
      <div class="form-group"><label class="form-label">${f}</label><input id="f-${f}" value="${esc(item[f] || '')}" /></div>`).join('')}
    <div class="form-group"><label class="form-label">上传图片</label>
      <input type="file" id="upload-file" accept="image/*" />
      <div class="form-help">popup/icon/promo 自动写入 /uploads/</div></div>
    <div class="modal-footer"><button class="btn btn-gray" id="modal-cancel">取消</button><button class="btn btn-primary" id="modal-save">保存</button></div>`
  modal.classList.add('show')
  const close = () => modal.classList.remove('show')
  $('#modal-close').onclick = close
  $('#modal-cancel').onclick = close
  $('#upload-file').onchange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const kind = slotKey === 'mineQuickApps' ? 'icon' : 'popup'
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/admin/upload?kind=${kind}`, { method: 'POST', body: fd, credentials: 'same-origin' })
    const data = await res.json()
    if (!res.ok) return toast(data.error || '上传失败')
    if (kind === 'icon') $('#f-icon').value = data.url
    else $('#f-image').value = data.url
    toast('上传成功')
  }
  $('#modal-save').onclick = async () => {
    const next = { ...item }
    for (const f of ['name', 'url', 'signUrl', 'coverUrl', 'image', 'icon']) {
      next[f] = $(`#f-${f}`)?.value.trim() || ''
    }
    await onSave(next)
    close()
    toast('已保存草稿')
  }
}

async function saveSlot(slotKey, items) {
  await api(`/api/admin/slots/${slotKey}`, { method: 'PUT', body: JSON.stringify({ items }) })
  await loadBundle()
}

async function renderApps(main) {
  const data = await api(`/api/admin/apps?page=${appsPage}&q=${encodeURIComponent(appsQuery)}`)
  main.innerHTML = `
    <div class="page-header"><span class="page-title">应用列表 (${data.total})</span>
      ${canWrite('apps') ? '<button class="btn btn-primary" id="add-app">新增应用</button>' : ''}</div>
    <div class="page-actions" style="margin-bottom:14px;">
      <input id="apps-q" placeholder="搜索名称/链接" value="${esc(appsQuery)}" style="max-width:280px" />
      <button class="btn btn-gray btn-sm" id="apps-search">搜索</button>
    </div>
    <div class="card" style="padding:0;overflow:auto;"><table>
      <thead><tr><th>图标</th><th>名称</th><th>链接</th><th>操作</th></tr></thead>
      <tbody>${data.apps.map((a) => `<tr>
        <td>${a.icon ? `<img class="img-thumb" src="${esc(a.icon)}" />` : '-'}</td>
        <td>${esc(a.name)}</td><td class="link-cell">${esc(a.url)}</td>
        <td class="action-btns">${canWrite('apps') ? `<button class="btn btn-blue btn-sm" data-edit="${esc(a.name)}">编辑</button><button class="btn btn-danger btn-sm" data-del="${esc(a.name)}">删</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>
    <div class="page-actions" style="margin-top:12px;">
      <button class="btn btn-gray btn-sm" id="apps-prev" ${appsPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span style="color:#777;font-size:13px;">第 ${data.page} 页</span>
      <button class="btn btn-gray btn-sm" id="apps-next" ${appsPage * data.pageSize >= data.total ? 'disabled' : ''}>下一页</button>
    </div>`
  $('#apps-search').onclick = () => { appsQuery = $('#apps-q').value.trim(); appsPage = 1; renderApps(main) }
  $('#apps-prev').onclick = () => { appsPage--; renderApps(main) }
  $('#apps-next').onclick = () => { appsPage++; renderApps(main) }
  $('#add-app').onclick = () => openAppModal(null)
  $$('[data-edit]').forEach((btn) => btn.onclick = () => {
    const app = data.apps.find((a) => a.name === btn.dataset.edit)
    openAppModal(app)
  })
  $$('[data-del]').forEach((btn) => btn.onclick = async () => {
    if (!confirm('确认删除应用？')) return
    await api(`/api/admin/apps/${encodeURIComponent(btn.dataset.del)}`, { method: 'DELETE' })
    toast('已删除')
    renderApps(main)
  })
}

function openAppModal(app) {
  const modal = $('#modal')
  const box = $('#modal-box')
  box.className = 'modal-box'
  box.innerHTML = `
    <div class="modal-header"><div class="modal-title">${app ? '编辑应用' : '新增应用'}</div><button class="modal-close" id="modal-close">×</button></div>
    <div class="form-group"><label class="form-label">名称</label><input id="app-name" value="${esc(app?.name || '')}" /></div>
    <div class="form-group"><label class="form-label">链接 url</label><input id="app-url" value="${esc(app?.url || '')}" /></div>
    <div class="form-group"><label class="form-label">signUrl（可选）</label><input id="app-sign" value="${esc(app?.signUrl || '')}" /></div>
    <div class="form-group"><label class="form-label">图标路径</label><input id="app-icon" value="${esc(app?.icon || '')}" /></div>
    <div class="form-group"><input type="file" id="app-upload" accept="image/*" /></div>
    <div class="modal-footer"><button class="btn btn-gray" id="modal-cancel">取消</button><button class="btn btn-primary" id="modal-save">保存</button></div>`
  modal.classList.add('show')
  const close = () => modal.classList.remove('show')
  $('#modal-close').onclick = close
  $('#modal-cancel').onclick = close
  $('#app-upload').onchange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload?kind=icon', { method: 'POST', body: fd, credentials: 'same-origin' })
    const data = await res.json()
    if (!res.ok) return toast(data.error || '上传失败')
    $('#app-icon').value = data.url
  }
  $('#modal-save').onclick = async () => {
    const body = {
      name: $('#app-name').value.trim(),
      url: $('#app-url').value.trim(),
      signUrl: $('#app-sign').value.trim(),
      icon: $('#app-icon').value.trim(),
    }
    if (app) {
      await api(`/api/admin/apps/${encodeURIComponent(app.name)}`, { method: 'PUT', body: JSON.stringify(body) })
    } else {
      await api('/api/admin/apps', { method: 'POST', body: JSON.stringify(body) })
    }
    close()
    toast('已保存草稿')
    await loadBundle()
    renderPage('apps')
  }
}

async function renderCategories(main) {
  const data = await api('/api/admin/category-apps')
  const json = JSON.stringify(data.categoryApps || {}, null, 2)
  main.innerHTML = `
    <div class="page-header"><span class="page-title">分类与应用映射</span></div>
    <div class="notice">JSON 编辑 categoryApps.byCategory / modes / modesByCategory。保存后需发布才生效。</div>
    <div class="card">
      <div class="form-group"><label class="form-label">categories（每行一个分类名）</label>
        <textarea id="cat-lines" rows="8">${esc((data.categories || []).join('\n'))}</textarea></div>
      <div class="form-group"><label class="form-label">categoryApps JSON</label>
        <textarea id="cat-json" rows="18">${esc(json)}</textarea></div>
      ${canWrite('categories') ? '<button class="btn btn-primary" id="cat-save">保存草稿</button>' : ''}
    </div>`
  $('#cat-save')?.addEventListener('click', async () => {
    let categoryApps
    try { categoryApps = JSON.parse($('#cat-json').value) } catch { return toast('JSON 格式错误') }
    const categories = $('#cat-lines').value.split('\n').map((s) => s.trim()).filter(Boolean)
    await api('/api/admin/category-apps', { method: 'PUT', body: JSON.stringify({ categoryApps, categories }) })
    toast('已保存草稿')
    await loadBundle()
  })
}

async function renderStats(main) {
  const data = await api('/api/admin/stats')
  main.innerHTML = `
    <div class="page-header"><span class="page-title">点击统计</span>
      <a class="btn btn-gray btn-sm" href="/api/admin/logs/export">导出操作日志</a></div>
    <div class="source-grid">
      <div class="card"><div style="font-weight:700;margin-bottom:12px;">按广告位</div>
        ${(data.bySlot || []).map((r) => `<div class="source-item"><span>${esc(r.slot || '(未标记)')}</span><strong>${r.clicks}</strong></div>`).join('') || '<div class="empty-row">暂无数据</div>'}
      </div>
      <div class="card"><div style="font-weight:700;margin-bottom:12px;">近 14 日</div>
        ${(data.daily || []).map((r) => `<div class="source-item"><span>${esc(r.day)}</span><strong>${r.clicks}</strong></div>`).join('') || '<div class="empty-row">暂无数据</div>'}
      </div>
    </div>`
}

async function renderLogs(main) {
  const data = await api('/api/admin/logs?limit=200')
  main.innerHTML = `
    <div class="page-header"><span class="page-title">操作日志</span>
      <a class="btn btn-gray btn-sm" href="/api/admin/logs/export">导出 CSV</a></div>
    <div class="card" style="padding:0;overflow:auto;"><table>
      <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>目标</th><th>IP</th></tr></thead>
      <tbody>${(data.logs || []).map((l) => `<tr>
        <td>${esc(l.created_at?.slice(0, 19))}</td><td>${esc(l.admin_name)}</td><td>${esc(l.action)}</td>
        <td>${esc(l.target_type)} ${esc(l.target_id)}</td><td>${esc(l.ip)}</td></tr>`).join('')}
      </tbody></table></div>`
}

async function renderCustomers(main) {
  const data = await api('/api/admin/customers?limit=100')
  main.innerHTML = `
    <div class="page-header"><span class="page-title">客户身份卡（${data.total}）</span></div>
    <div class="notice">一人一卡，库级 UNIQUE。后台只读，不提供补发卡。</div>
    <div class="card" style="padding:0;overflow:auto;"><table>
      <thead><tr><th>客户ID</th><th>身份卡号</th><th>邀请码</th><th>邀请人</th><th>签发</th></tr></thead>
      <tbody>${(data.customers || []).map((c) => `<tr>
        <td>${esc(c.id)}</td><td>${esc(c.card_no)}</td><td>${esc(c.invite_code)}</td>
        <td>${esc(c.invited_by || '—')}</td><td>${esc((c.issued_at || c.created_at || '').slice(0, 19))}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty-row">暂无客户</td></tr>'}
      </tbody></table></div>`
}

async function renderApiSession(main) {
  if (user?.role !== 'super') {
    main.innerHTML = '<div class="card">仅超管可轮换原站 token</div>'
    return
  }
  const data = await api('/api/admin/api-session')
  const live = data.live || {}
  main.innerHTML = `
    <div class="page-header"><span class="page-title">原站 Token</span></div>
    <div class="notice">前台启动时读 <code>/data/api-session.json</code>。这里保存后立刻上线，不用再点「发布到前台」。不要把完整 token 发到群里。</div>
    <div class="card" style="max-width:640px;">
      <p class="form-help">线上 uid：<code>${esc(live.uid || '—')}</code></p>
      <p class="form-help">摘要：<code>${esc(live.tokenPreview || '未配置')}</code> · ${live.tokenLen || 0} 位</p>
      <p class="form-help">更新时间：${esc(live.at || '—')}</p>
      <p class="form-help">资源域名：<code>${esc(live.resBase || '—')}</code></p>
      <div class="form-group"><label class="form-label">新 JWT</label>
        <textarea id="api-token" rows="4" placeholder="粘贴新的 eyJ... JWT" style="width:100%;box-sizing:border-box;"></textarea></div>
      <div class="form-group"><label class="form-label">资源域名（可空，沿用当前）</label>
        <input id="api-resbase" value="${esc(live.resBase || '')}" /></div>
      <button class="btn btn-primary" id="api-save">保存并立即上线</button>
    </div>`
  $('#api-save').onclick = async () => {
    const token = $('#api-token').value.trim()
    if (!token) return toast('请粘贴新 token')
    if (!confirm('确认立刻替换线上原站 token？精选/播放/用户信息会马上改用新钥匙。')) return
    const body = { token, resBase: $('#api-resbase').value.trim() }
    const out = await api('/api/admin/api-session', { method: 'PUT', body: JSON.stringify(body) })
    toast(`已上线 uid ${out.session?.uid || ''}`)
    await loadBundle()
    renderApiSession(main)
  }
}

function openPasswordModal(opts = {}) {
  const required = Boolean(opts.required || user?.mustChangePassword)
  const modal = $('#modal')
  const box = $('#modal-box')
  box.className = 'modal-box narrow'
  box.innerHTML = `
    <div class="modal-header"><div class="modal-title">修改密码</div>
      ${required ? '' : '<button class="modal-close" id="modal-close" type="button">×</button>'}</div>
    ${required ? '<div class="notice">当前账号还在用初始密码，必须先改密才能继续。</div>' : ''}
    <div class="form-group"><label class="form-label">原密码</label><input type="password" id="pw-old" autocomplete="current-password" /></div>
    <div class="form-group"><label class="form-label">新密码（至少 10 位）</label><input type="password" id="pw-new" autocomplete="new-password" /></div>
    <div class="form-group"><label class="form-label">确认新密码</label><input type="password" id="pw-confirm" autocomplete="new-password" /></div>
    <div class="err" id="pw-err"></div>
    <div class="modal-footer">
      ${required ? '' : '<button class="btn btn-gray" id="modal-cancel" type="button">取消</button>'}
      <button class="btn btn-primary" id="pw-save" type="button">保存密码</button>
    </div>`
  modal.classList.add('show')
  const close = () => {
    if (required) return
    modal.classList.remove('show')
  }
  $('#modal-close')?.addEventListener('click', close)
  $('#modal-cancel')?.addEventListener('click', close)
  $('#pw-save').onclick = async () => {
    const err = $('#pw-err')
    err.textContent = ''
    const oldPassword = $('#pw-old').value
    const newPassword = $('#pw-new').value
    const confirm = $('#pw-confirm').value
    if (!oldPassword) return (err.textContent = '请填写原密码')
    if (newPassword.length < 10) return (err.textContent = '新密码至少 10 位')
    if (newPassword !== confirm) return (err.textContent = '两次新密码不一致')
    if (newPassword === oldPassword) return (err.textContent = '新密码不能和原密码相同')
    try {
      await api('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      user = null
      modal.classList.remove('show')
      showLogin()
      $('#login-pass').value = ''
      toast('密码已更新，所有旧会话已退出，请重新登录')
    } catch (e) {
      err.textContent = e.message
    }
  }
}

function renderSecurity(main) {
  main.innerHTML = `
    <div class="page-header"><span class="page-title">安全设置</span></div>
    <div class="card" style="max-width:520px;">
      <h3 style="margin-bottom:12px;">修改密码</h3>
      <p class="form-help">任何登录账号都可以改自己的密码，不必找超管。</p>
      <button class="btn btn-primary" id="pw-open">修改我的密码</button>
      <hr style="border-color:#222;margin:22px 0" />
      <h3 style="margin-bottom:12px;">两步验证 (TOTP)</h3>
      <div id="totp-area">${user.totpEnabled ? '<input id="totp-disable-code" placeholder="当前 6 位验证码" /><button class="btn btn-gray" id="totp-disable">关闭 2FA 后重新设置</button>' : '<button class="btn btn-blue" id="totp-setup">生成密钥</button>'}</div>
    </div>`
  $('#pw-open').onclick = () => openPasswordModal()
  if ($('#totp-disable')) $('#totp-disable').onclick = async () => {
    try {
      await api('/api/admin/totp/disable', { method: 'POST', body: JSON.stringify({ code: $('#totp-disable-code').value.trim() }) })
      user.totpEnabled = false
      renderSecurity(main)
      toast('2FA 已关闭，可重新设置')
    } catch (error) { toast(error.message) }
  }
  if ($('#totp-setup')) $('#totp-setup').onclick = async () => {
    try {
    const data = await api('/api/admin/totp/setup', { method: 'POST', body: '{}' })
    $('#totp-area').innerHTML = `
      <p class="form-help">密钥：<code>${esc(data.secret)}</code></p>
      <p class="form-help">otpauth：<a href="${esc(data.otpauth)}" target="_blank">${esc(data.otpauth)}</a></p>
      <div class="form-group"><input id="totp-code" placeholder="输入 6 位验证码启用" /></div>
      <button class="btn btn-primary" id="totp-enable">启用 2FA</button>`
    $('#totp-enable').onclick = async () => {
      try {
      await api('/api/admin/totp/enable', { method: 'POST', body: JSON.stringify({ code: $('#totp-code').value.trim() }) })
      toast('2FA 已启用')
      user.totpEnabled = true
      renderSecurity(main)
      } catch (error) { toast(error.message) }
    }
    } catch (error) { toast(error.message) }
  }
}

$('#login-btn').onclick = login
$('#logout-btn').onclick = logout
$('#publish-btn').onclick = publish
$('#preview-btn').onclick = () => window.open('https://b12sl5x.cn/#/appcenter', '_blank')
$('#password-btn').onclick = () => openPasswordModal()

;(async function init() {
  try {
    const data = await api('/api/admin/me')
    user = data.user
    if (user.mustChangePassword) return openPasswordModal({ required: true })
    await loadBundle()
    showAdmin()
    if (user.mustChangePassword) openPasswordModal({ required: true })
  } catch {
    showLogin()
  }
})()
