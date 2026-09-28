import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync('android/app/src/main/assets/native-bridge.js', 'utf8')
function browser(origin = 'https://b12sl5x.cn', mainFrame = true) {
  const messages = [], native = { postMessage: text => messages.push(JSON.parse(text)) }
  class Anchor { constructor(href, download = '') { this.href = href; this.download = download; this.clicks = 0 } click() { this.clicks++ } }
  const window = { DewuNative: native }
  window.top = mainFrame ? window : {}
  const listeners = []
  const context = vm.createContext({ window, location: { origin }, DewuNative: native, navigator: {}, HTMLAnchorElement: Anchor,
    document: { addEventListener: (name, callback) => listeners.push(callback) } })
  return { context, Anchor, messages, listeners }
}
const live = browser()
vm.runInContext(source, live.context)
const image = new live.Anchor('data:image/png;base64,iVBORw0KGgo=', '123.png')
image.click()
assert.equal(image.clicks, 0)
assert.deepEqual(live.messages[0], { type: 'saveImage', data: image.href, name: '123.png' })
const link = new live.Anchor('https://b12sl5x.cn/h5/app.apk')
link.click()
assert.equal(link.clicks, 1)
await live.context.navigator.clipboard.writeText('identity-123')
assert.deepEqual(live.messages[1], { type: 'copy', text: 'identity-123' })
vm.runInContext(source, live.context)
assert.equal(live.listeners.length, 1, 'Bridge must not install twice')
for (const page of [browser('http://okqpkdj.cn'), browser('https://b12sl5x.cn', false)]) {
  vm.runInContext(source, page.context)
  assert.equal(page.listeners.length, 0)
  assert.equal(page.context.navigator.clipboard, undefined)
}
console.log('PASS: native bridge handles identity copy/PNG only on the main trusted page; normal links remain unchanged')
