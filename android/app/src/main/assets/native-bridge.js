(() => {
  if (window.top !== window || location.origin !== 'https://b12sl5x.cn' ||
      !window.DewuNative || window.__dewuNativeReady) return;
  window.__dewuNativeReady = true;
  const post = message => DewuNative.postMessage(JSON.stringify(message));
  const save = anchor => {
    if (!anchor.href.startsWith('data:image/png;base64,')) return false;
    post({ type: 'saveImage', data: anchor.href, name: anchor.download || 'dewu-card.png' });
    return true;
  };
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!save(this)) return originalClick.call(this);
  };
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a');
    if (anchor && save(anchor)) event.preventDefault();
  }, true);
  try {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: text => { post({ type: 'copy', text: String(text) }); return Promise.resolve(); }
    }});
  } catch (_) { /* The site's execCommand fallback remains available. */ }
})();
