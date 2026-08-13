/**
 * ZARA — permission manager.
 *
 * Central place to query and request access to sensitive resources. Nothing in
 * ZARA touches the microphone, camera or screen without going through here
 * first, and every state is surfaced in Settings.
 */

import { reactive, readonly } from 'vue'
import type { PermissionState, ZaraPermission } from './types'

type PermissionMap = Record<ZaraPermission, PermissionState>

const state = reactive<PermissionMap>({
  microphone: 'prompt',
  camera: 'prompt',
  screen: 'prompt',
  browser: 'prompt',
  computer: 'prompt',
  files: 'prompt',
  notifications: 'prompt',
})

export const permissions = readonly(state)

export function getPermission(name: ZaraPermission): PermissionState {
  return state[name]
}

export function setPermission(name: ZaraPermission, value: PermissionState) {
  state[name] = value
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).electron)
}

/**
 * Queries the browser Permissions API without prompting, where supported.
 */
async function queryMedia(
  name: 'microphone' | 'camera'
): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'prompt'
  }
  try {
    const status = await navigator.permissions.query({
      name: name as PermissionName,
    })
    if (status.state === 'granted') return 'granted'
    if (status.state === 'denied') return 'denied'
    return 'prompt'
  } catch {
    return 'prompt'
  }
}

/**
 * Requests microphone access. Returns the resulting state and never throws —
 * callers branch on the state and show an honest message.
 */
export async function requestMicrophone(): Promise<PermissionState> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    setPermission('microphone', 'unavailable')
    return 'unavailable'
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Release immediately — the VAD engine opens its own stream.
    stream.getTracks().forEach(track => track.stop())
    setPermission('microphone', 'granted')
    return 'granted'
  } catch (error: any) {
    const denied =
      error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
    const missing =
      error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError'
    const next: PermissionState = denied
      ? 'denied'
      : missing
        ? 'unavailable'
        : 'denied'
    setPermission('microphone', next)
    return next
  }
}

/** Requests camera access and hands back the live stream when granted. */
export async function requestCamera(): Promise<{
  state: PermissionState
  stream: MediaStream | null
}> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    setPermission('camera', 'unavailable')
    return { state: 'unavailable', stream: null }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    setPermission('camera', 'granted')
    return { state: 'granted', stream }
  } catch (error: any) {
    const denied =
      error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
    const missing =
      error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError'
    const next: PermissionState = denied
      ? 'denied'
      : missing
        ? 'unavailable'
        : 'denied'
    setPermission('camera', next)
    return { state: next, stream: null }
  }
}

/**
 * Refreshes every permission state. Called at startup and when Settings opens.
 */
export async function refreshAllPermissions(): Promise<PermissionMap> {
  state.microphone = await queryMedia('microphone')
  state.camera = await queryMedia('camera')

  // Screen capture and computer control are Electron-only capabilities.
  state.screen = isElectron() ? 'granted' : 'unavailable'
  state.computer = isElectron() ? 'granted' : 'unavailable'
  state.files = isElectron() ? 'prompt' : 'unavailable'

  // Browser control depends on the extension bridge being attached.
  try {
    if (typeof window !== 'undefined' && window.aliceIPC) {
      const result = await window.aliceIPC.invoke('websocket:bridge-status')
      state.browser = result?.connected ? 'granted' : 'prompt'
    } else {
      state.browser = 'unavailable'
    }
  } catch {
    state.browser = 'prompt'
  }

  if (typeof Notification !== 'undefined') {
    state.notifications =
      Notification.permission === 'granted'
        ? 'granted'
        : Notification.permission === 'denied'
          ? 'denied'
          : 'prompt'
  } else {
    state.notifications = 'unavailable'
  }

  return { ...state }
}

/** Human-readable label for the Settings screen. */
export function permissionLabel(name: ZaraPermission): string {
  const labels: Record<ZaraPermission, string> = {
    microphone: 'Microphone',
    camera: 'Camera',
    screen: 'Screen',
    browser: 'Browser Control',
    computer: 'Computer Control',
    files: 'Files',
    notifications: 'Notifications',
  }
  return labels[name]
}
