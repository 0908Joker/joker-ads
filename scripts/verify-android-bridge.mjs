import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync('android/app/src/main/assets/native-bridge.js', 'utf8')
function browser(origin = 'https://b12sl5x.cn', mainFrame = true) {
  const messages = [], native = { postMessage: text => messages.push(JSON.parse(text)) }, timers = new Map()
  let timerId = 0
  class Anchor { constructor(href, download = '') { this.href = href; this.download = download; this.clicks = 0 } click() { this.clicks++ } }
  const window = { DewuNative: native }
  window.top = mainFrame ? window : {}
  const listeners = []
  const context = vm.createContext({ window, location: { origin }, DewuNative: native, navigator: {}, HTMLAnchorElement: Anchor,
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId }, clearTimeout: id => timers.delete(id),
    document: { addEventListener: (name, callback) => listeners.push(callback) } })
  return { context, Anchor, messages, listeners, timers, reply: data => native.onmessage({ data: JSON.stringify(data) }) }
}
const live = browser()
vm.runInContext(source, live.context)
const link = new live.Anchor('https://b12sl5x.cn/h5/app.apk')
link.click()
assert.equal(link.clicks, 1)
let settled = false
const copied = live.context.navigator.clipboard.writeText('identity-123').then(() => { settled = true })
await Promise.resolve()
assert.equal(settled, false, 'posting is not clipboard success')
const copy = live.messages.at(-1)
assert.equal(copy.type, 'copy')
assert.equal(copy.text, 'identity-123')
live.reply({ id: 'wrong', status: 'success' })
await Promise.resolve()
assert.equal(settled, false)
live.reply({ id: copy.id, status: 'success' })
await copied
assert.equal(live.timers.size, 0)
const rejected = live.context.navigator.clipboard.writeText('x'.repeat(8193))
live.reply({ id: live.messages.at(-1).id, status: 'error', error: 'TEXT_TOO_LONG' })
await assert.rejects(rejected, /TEXT_TOO_LONG/)
const timedOut = live.context.navigator.clipboard.writeText('timeout')
const timer = [...live.timers.values()][0]
assert.equal(timer.delay, 5000)
timer.fn()
await assert.rejects(timedOut, /超时/)
live.reply({ id: live.messages.at(-1).id, status: 'success' }) // Late acknowledgements are ignored.
let saved = false
const image = 'data:image/png;base64,iVBORw0KGgo='
const save = live.context.window.DewuBridge.saveImage(image, '123.png').then(result => { saved = true; return result })
await Promise.resolve()
assert.equal(saved, false)
live.reply({ id: live.messages.at(-1).id, status: 'cancelled' })
assert.equal((await save).status, 'cancelled')
const failedSave = live.context.window.DewuBridge.saveImage(image, '123.png')
live.reply({ id: live.messages.at(-1).id, status: 'error', error: 'WRITE_FAILED' })
await assert.rejects(failedSave, /WRITE_FAILED/)
const successSave = live.context.window.DewuBridge.saveImage(image, '123.png')
live.reply({ id: live.messages.at(-1).id, status: 'success' })
assert.equal((await successSave).status, 'success')
const anchor = new live.Anchor(image, '123.png')
anchor.click()
assert.equal(anchor.clicks, 0)
assert.equal(live.messages.at(-1).type, 'saveImage')
live.reply({ id: live.messages.at(-1).id, status: 'cancelled' })
vm.runInContext(source, live.context)
assert.equal(live.listeners.length, 1, 'Bridge must not install twice')
for (const page of [browser('http://okqpkdj.cn'), browser('https://b12sl5x.cn', false)]) {
  vm.runInContext(source, page.context)
  assert.equal(page.listeners.length, 0)
  assert.equal(page.context.navigator.clipboard, undefined)
}
console.log('PASS: real bridge waits for matching copy/save acknowledgement; rejection, 5s timeout, cancellation, late/unknown replies; trusted main page only; links retained')
