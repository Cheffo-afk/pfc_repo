import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Config ───────────────────────────────────────────────────────────────────
// URL WebSocket: configurabile via VITE_WS_URL.
// Se VITE_WS_URL non include un path, forza automaticamente "/ws".
function resolveWebSocketUrl() {
  const fromEnv = (import.meta.env.VITE_WS_URL as string | undefined)?.trim()
  const fallback = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

  if (!fromEnv) {
    return fallback
  }

  try {
    const isAbsolute = /^(wss?:|https?:)/i.test(fromEnv)
    const parsed = new URL(fromEnv, isAbsolute ? undefined : window.location.origin)

    // Permette anche URL http/https in env convertendole alla controparte ws/wss.
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'ws:'
    }
    if (parsed.protocol === 'https:') {
      parsed.protocol = 'wss:'
    }

    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = '/ws'
    }

    return parsed.toString()
  } catch {
    return fallback
  }
}

const WS_URL = resolveWebSocketUrl()

import type { PresenceStatus, ChatMessage, HistoryResult } from '../types'

// Handler interni — non esposti all'esterno, usati solo dai ref.
type ChatHandler = (msg: ChatMessage) => void
type HistoryHandler = (result: HistoryResult) => void
type SignalingHandler = (action: string, fromUserId: number, payload: unknown) => void

type WsSnapshot = {
  connected: boolean
  wsError: string | null
  presences: Record<string, PresenceStatus>
}

let snapshot: WsSnapshot = {
  connected: false,
  wsError: null,
  presences: {},
}

let ws: WebSocket | null = null
let reconnectTimer: number | null = null
let hasStarted = false
let reconnectEnabled = true

const snapshotListeners = new Set<(next: WsSnapshot) => void>()
const chatListeners = new Set<ChatHandler>()
const historyListeners = new Set<HistoryHandler>()
const signalingListeners = new Set<SignalingHandler>()

function emitSnapshot() {
  snapshotListeners.forEach((listener) => listener(snapshot))
}

function updateSnapshot(partial: Partial<WsSnapshot>) {
  snapshot = { ...snapshot, ...partial }
  emitSnapshot()
}

function subscribeSnapshot(listener: (next: WsSnapshot) => void) {
  snapshotListeners.add(listener)
  listener(snapshot)
  return () => {
    snapshotListeners.delete(listener)
  }
}

function sendRaw(data: object) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function handleRawMessage(event: MessageEvent<unknown>) {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(event.data))
  } catch {
    return
  }

  if (!parsed || typeof parsed !== 'object') return

  const msg = parsed as Record<string, unknown>
  const channel = msg.channel as string | undefined
  const action = msg.action as string | undefined
  const payload = msg.payload

  if (channel === 'system' && action === 'bound') {
    updateSnapshot({ wsError: null })
    sendRaw({ channel: 'presence', action: 'snapshot' })
    return
  }

  if (channel === 'system' && action === 'error') {
    const message = (payload as Record<string, unknown> | undefined)?.message
    if (typeof message === 'string' && message.trim()) {
      updateSnapshot({ wsError: message })
    }
    return
  }

  if (channel === 'presence' && action === 'snapshot') {
    const users = (payload as Record<string, unknown> | undefined)?.users
    if (!Array.isArray(users)) return

    const nextPresences: Record<string, PresenceStatus> = {}
    for (const u of users) {
      const entry = u as { username?: string; status?: PresenceStatus }
      if (entry.username) {
        nextPresences[entry.username] = entry.status ?? 'offline'
      }
    }

    updateSnapshot({ presences: nextPresences })
    return
  }

  if (channel === 'chat' && action === 'message') {
    chatListeners.forEach((handler) => handler(payload as ChatMessage))
    return
  }

  if (channel === 'chat' && action === 'history') {
    historyListeners.forEach((handler) => handler(payload as HistoryResult))
    return
  }

  if (channel === 'signaling') {
    const sigPayload = payload as Record<string, unknown> | undefined
    const fromUserId = typeof sigPayload?.fromUserId === 'number' ? sigPayload.fromUserId : 0
    signalingListeners.forEach((handler) => handler(action ?? '', fromUserId, payload))
  }
}

function connectSharedSocket() {
  if (!reconnectEnabled) {
    return
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    updateSnapshot({ connected: true, wsError: null })
  }

  ws.onclose = () => {
    ws = null
    updateSnapshot({ connected: false })

    if (!reconnectEnabled) {
      return
    }

    reconnectTimer = window.setTimeout(() => {
      connectSharedSocket()
    }, 1500)
  }

  ws.onerror = () => {
    updateSnapshot({ connected: false })
    ws?.close()
  }

  ws.onmessage = handleRawMessage
}

function ensureSharedSocketStarted() {
  reconnectEnabled = true

  if (hasStarted) {
    return
  }

  hasStarted = true

  window.setTimeout(() => {
    connectSharedSocket()
  }, 0)
}

function disconnectSharedSocket() {
  reconnectEnabled = false

  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close()
  }

  ws = null
  updateSnapshot({ connected: false })
}

export function disconnectWebSocket() {
  disconnectSharedSocket()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Gestisce l'intero ciclo di vita WebSocket: connessione, riconnessione automatica,
// parsing messaggi e smistamento sui canali (chat, presenza, signaling).
export function useWebSocket() {
  const [state, setState] = useState<WsSnapshot>(snapshot)
  const onMessageRef = useRef<ChatHandler | null>(null)
  const onHistoryRef = useRef<HistoryHandler | null>(null)
  const onSignalingRef = useRef<SignalingHandler | null>(null)

  useEffect(() => subscribeSnapshot(setState), [])

  useEffect(() => {
    ensureSharedSocketStarted()
  }, [])

  useEffect(() => {
    const chatBridge: ChatHandler = (msg) => {
      onMessageRef.current?.(msg)
    }

    const historyBridge: HistoryHandler = (result) => {
      onHistoryRef.current?.(result)
    }

    const signalingBridge: SignalingHandler = (action, fromUserId, payload) => {
      onSignalingRef.current?.(action, fromUserId, payload)
    }

    chatListeners.add(chatBridge)
    historyListeners.add(historyBridge)
    signalingListeners.add(signalingBridge)

    return () => {
      chatListeners.delete(chatBridge)
      historyListeners.delete(historyBridge)
      signalingListeners.delete(signalingBridge)
    }
  }, [])

  const sendChatMessage = useCallback((toUserId: number, content: string) => {
    sendRaw({ channel: 'chat', action: 'send', toUserId, payload: content })
  }, [])

  const requestHistory = useCallback((toUserId: number, beforeMessageId?: number) => {
    const payload = beforeMessageId != null ? { beforeMessageId } : {}
    sendRaw({ channel: 'chat', action: 'history', toUserId, payload })
  }, [])

  const sendSignaling = useCallback((action: string, toUserId: number, payload: object) => {
    sendRaw({ channel: 'signaling', action, toUserId, payload })
  }, [])

  const setOnMessage = useCallback((handler: ChatHandler) => {
    onMessageRef.current = handler
  }, [])

  const setOnHistory = useCallback((handler: HistoryHandler) => {
    onHistoryRef.current = handler
  }, [])

  const setOnSignaling = useCallback((handler: SignalingHandler) => {
    onSignalingRef.current = handler
  }, [])

  const setPresenceStatus = useCallback((status: 'online' | 'nonAlComputer') => {
    sendRaw({ channel: 'presence', action: 'set-status', payload: status })
  }, [])

  const disconnect = useCallback(() => {
    disconnectSharedSocket()
  }, [])

  return {
    connected: state.connected,
    wsError: state.wsError,
    presences: state.presences,
    sendChatMessage,
    requestHistory,
    sendSignaling,
    setOnMessage,
    setOnHistory,
    setOnSignaling,
    setPresenceStatus,
    disconnect,
  }
}
