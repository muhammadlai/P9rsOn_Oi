/**
 * ZARA Browser Bridge — content script.
 *
 * Lets Aitzaz send the current selection to ZARA from the page context.
 * Kept intentionally small: page reading is done on demand by the service
 * worker, so nothing is streamed anywhere in the background.
 */

document.addEventListener('keydown', event => {
  // Ctrl/Cmd + Shift + Z — send the current selection to ZARA.
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
    const selectedText = String(window.getSelection() || '').trim()
    if (!selectedText) return
    chrome.runtime.sendMessage({
      type: 'context_action',
      data: {
        action: 'tell_more',
        selectedText,
        url: location.href,
        title: document.title,
      },
    })
  }
})
