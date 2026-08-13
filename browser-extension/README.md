# ZARA Browser Bridge

Real browser control for ZARA.

## Why this exists

A desktop app can open a URL in your default browser, but browser security
means **nothing outside the browser can go back, go forward, refresh, or close a
tab**. That requires code running *inside* the browser. This extension is that
component.

Without it installed, ZARA will honestly report
`BROWSER CONTROL NOT CONNECTED` for tab commands rather than pretending they
worked.

## What works without the extension

- "Open Google" / "Open YouTube" / "Open ChatGPT"
- "Search for AI news"
- "Search YouTube for AI videos"
- "Open a new tab" (falls back to launching your default browser)

## What needs the extension

- "Go back" / "Go forward"
- "Refresh"
- "Close this tab"
- "What's on this page?" (page reading)

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select this `browser-extension` folder.
5. Make sure the ZARA desktop app is running.

The extension badge shows **ON** when it is connected to ZARA.

## Connection

The extension connects to `ws://127.0.0.1:5421`. If that port is busy, the
desktop app falls back to 5422–5426 and the extension scans that range
automatically. The port is configurable via `ZARA_BRIDGE_PORT` in `.env`.

Traffic is local-only — the bridge never leaves your machine.
