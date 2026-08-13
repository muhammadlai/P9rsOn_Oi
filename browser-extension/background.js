/**
 * ZARA Browser Bridge — service worker.
 *
 * Maintains a WebSocket connection to the ZARA desktop app on 127.0.0.1 and
 * executes tab commands that a desktop app cannot perform on its own.
 *
 * Every command replies with an explicit success/failure so ZARA can report
 * the truth instead of assuming the action worked.
 */

const DEFAULT_PORT = 5421
const PORT_RANGE = 5 // the app falls back to port+1..port+5 when busy
const RECONNECT_DELAY_MS = 3000

let socket = null
let reconnectTimer = null
let portOffset = 0

function log(...args) {
  console.log('[ZARA Bridge]', ...args)
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  const port = DEFAULT_PORT + portOffset
  const url = `ws://127.0.0.1:${port}`

  try {
    socket = new WebSocket(url)
  } catch (error) {
    scheduleReconnect()
    return
  }

  socket.onopen = () => {
    log(`Connected to ZARA on port ${port}`)
    portOffset = 0
    chrome.action.setBadgeText({ text: 'ON' })
    chrome.action.setBadgeBackgroundColor({ color: '#22d3ee' })
    send({ type: 'bridge_hello', client: 'zara-browser-extension', version: '1.0.0' })
  }

  socket.onmessage = async event => {
    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }

    if (message.type === 'browser_command') {
      const result = await handleCommand(message.command, message.payload || {})
      send({
        type: 'command_response',
        requestId: message.requestId,
        command: message.command,
        ...result,
      })
      return
    }

    if (message.type === 'get_context') {
      const context = await getPageContext(message.options || {})
      send({ type: 'context_response', requestId: message.requestId, ...context })
    }
  }

  socket.onclose = () => {
    chrome.action.setBadgeText({ text: '' })
    // Cycle ports in case the app picked a fallback.
    portOffset = (portOffset + 1) % (PORT_RANGE + 1)
    scheduleReconnect()
  }

  socket.onerror = () => {
    try {
      socket.close()
    } catch {
      /* already closing */
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_DELAY_MS)
}

function send(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab || null
}

/** Executes a tab command and reports what actually happened. */
async function handleCommand(command, payload) {
  try {
    const tab = await activeTab()

    switch (command) {
      case 'browser_back': {
        if (!tab) return { success: false, error: 'No active tab.' }
        await chrome.tabs.goBack(tab.id)
        return { success: true, message: 'Went back.' }
      }
      case 'browser_forward': {
        if (!tab) return { success: false, error: 'No active tab.' }
        await chrome.tabs.goForward(tab.id)
        return { success: true, message: 'Went forward.' }
      }
      case 'refresh_page': {
        if (!tab) return { success: false, error: 'No active tab.' }
        await chrome.tabs.reload(tab.id)
        return { success: true, message: 'Page refreshed.' }
      }
      case 'new_tab': {
        const created = await chrome.tabs.create({
          url: payload.url || undefined,
          active: true,
        })
        return { success: true, message: 'Opened a new tab.', tabId: created.id }
      }
      case 'close_tab': {
        if (!tab) return { success: false, error: 'No active tab.' }
        await chrome.tabs.remove(tab.id)
        return { success: true, message: 'Closed the tab.' }
      }
      default:
        return { success: false, error: `Unknown command: ${command}` }
    }
  } catch (error) {
    // chrome.tabs.goBack rejects when there is no history entry — that is a
    // genuine failure and must be reported as one.
    return { success: false, error: error?.message || 'Command failed.' }
  }
}

/** Reads the current page so ZARA can answer "what's on this page?". */
async function getPageContext(options) {
  try {
    const tab = await activeTab()
    if (!tab) return { success: false, error: 'No active tab.' }

    const maxLength = Math.min(Number(options.maxLength) || 4000, 20000)

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: limit => ({
        url: location.href,
        title: document.title,
        selection: String(window.getSelection() || ''),
        content: (document.body?.innerText || '').slice(0, limit),
      }),
      args: [maxLength],
    })

    const result = injection?.result || {}
    return {
      success: true,
      url: result.url || tab.url,
      title: result.title || tab.title,
      selection: result.selection || '',
      content: result.content || '',
    }
  } catch (error) {
    return { success: false, error: error?.message || 'Could not read the page.' }
  }
}

chrome.runtime.onStartup.addListener(connect)
chrome.runtime.onInstalled.addListener(connect)

// Keep the socket alive across service-worker suspensions.
chrome.alarms?.create('zara-keepalive', { periodInMinutes: 0.5 })
chrome.alarms?.onAlarm.addListener(connect)

connect()
