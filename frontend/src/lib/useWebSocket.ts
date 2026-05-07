import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Config ───────────────────────────────────────────────────────────────────
// URL WebSocket: configurabile via VITE_WS_URL, altrimenti derivato dal host corrente.
const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

// ─── Re-export tipi ───────────────────────────────────────────────────────────
export type { PresenceStatus, ChatMessage, HistoryResult } from '../types'
import type { PresenceStatus, ChatMessage, HistoryResult } from '../types'

// Handler interni — non esposti all'esterno, usati solo dai ref.
type ChatHandler = (msg: ChatMessage) => void
type HistoryHandler = (result: HistoryResult) => void
type SignalingHandler = (action: string, fromUserId: number, payload: unknown) => void

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Gestisce l'intero ciclo di vita WebSocket: connessione, riconnessione automatica,
// parsing messaggi e smistamento sui canali (chat, presenza, signaling).
export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const [presences, setPresences] = useState<Record<string, PresenceStatus>>({})
  const [wsError, setWsError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef<ChatHandler | null>(null)
  const onHistoryRef = useRef<HistoryHandler | null>(null)
  const onSignalingRef = useRef<SignalingHandler | null>(null)

  // ─── Parser messaggi in arrivo ────────────────────────────────────────────
  // Smista i frame ricevuti dal server sui canali logici corretti.
  const handleRawMessage = useCallback((event: MessageEvent<unknown>) => {
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
      setWsError(null)
      wsRef.current?.send(JSON.stringify({ channel: 'presence', action: 'snapshot' }))
      return
    }

    if (channel === 'system' && action === 'error') {
      const message = (payload as Record<string, unknown> | undefined)?.message
      if (typeof message === 'string' && message.trim()) {
        setWsError(message)
      }
      return
    }

    if (channel === 'presence' && action === 'snapshot') {
      const users = (payload as Record<string, unknown> | undefined)?.users
      if (!Array.isArray(users)) return
      const snap: Record<string, PresenceStatus> = {}
      for (const u of users) {
        const entry = u as { username?: string; status?: PresenceStatus }
        if (entry.username) snap[entry.username] = entry.status ?? 'offline'
      }
      setPresences(snap)
      return
    }

    if (channel === 'chat' && action === 'message') {
      onMessageRef.current?.(payload as ChatMessage)
      return
    }

    if (channel === 'chat' && action === 'history') {
      onHistoryRef.current?.(payload as HistoryResult)
      return
    }

    if (channel === 'signaling') {
      const sigPayload = payload as Record<string, unknown> | undefined
      const fromUserId = typeof sigPayload?.fromUserId === 'number' ? sigPayload.fromUserId : 0
      onSignalingRef.current?.(action ?? '', fromUserId, payload)
      return
    }
  }, [])

  // ─── Ciclo di vita connessione ────────────────────────────────────────────
  useEffect(() => {
    let unmounted = false
    let reconnectTimer: number | null = null
    let connectTimer: number | null = null

    const connect = () => {
      if (unmounted) return

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setWsError(null)
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null

        if (unmounted) return

        reconnectTimer = window.setTimeout(() => {
          connect()
        }, 1500)
      }

      ws.onerror = () => {
        setConnected(false)
        ws.close()
      }

      ws.onmessage = handleRawMessage
    }

    // In React StrictMode the first mount is intentionally torn down immediately.
    // Deferring the initial connect lets that teardown cancel the attempt instead of
    // opening and closing a socket that would log a browser-level connection error.
    connectTimer = window.setTimeout(() => {
      connect()
    }, 0)

    return () => {
      unmounted = true
      if (connectTimer !== null) {
        window.clearTimeout(connectTimer)
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [handleRawMessage])

  // ─── API pubblica ─────────────────────────────────────────────────────────
  const sendRaw = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  const sendChatMessage = useCallback((toUserId: number, content: string) => {
    sendRaw({ channel: 'chat', action: 'send', toUserId, payload: content })
  }, [sendRaw])

  const requestHistory = useCallback((toUserId: number, beforeMessageId?: number) => {
    const payload = beforeMessageId != null ? { beforeMessageId } : {}
    sendRaw({ channel: 'chat', action: 'history', toUserId, payload })
  }, [sendRaw])

  const sendSignaling = useCallback((action: string, toUserId: number, payload: object) => {
    sendRaw({ channel: 'signaling', action, toUserId, payload })
  }, [sendRaw])

  const setOnMessage = useCallback((handler: ChatHandler) => {
    onMessageRef.current = handler
  }, [])

  const setOnHistory = useCallback((handler: HistoryHandler) => {
    onHistoryRef.current = handler
  }, [])

  const setOnSignaling = useCallback((handler: SignalingHandler) => {
    onSignalingRef.current = handler
  }, [])

  return {
    connected,
    wsError,
    presences,
    sendChatMessage,
    requestHistory,
    sendSignaling,
    setOnMessage,
    setOnHistory,
    setOnSignaling,
  }
}
