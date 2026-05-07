import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Config ───────────────────────────────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

// ─── Re-export tipi ───────────────────────────────────────────────────────────
export type { CallState, IncomingCallInfo } from '../types'
import type { CallState, IncomingCallInfo } from '../types'

// Tipi interni — usati solo per serializzare SDP/ICE sul canale signaling.
type SerializableSessionDescription = {
  type: RTCSdpType
  sdp?: string
}

type SerializableIceCandidate = {
  candidate?: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

type FullscreenTarget = 'local' | 'remote'

type SendSignalingFn = (action: string, toUserId: number, payload: object) => void

type UseWebRTCOptions = {
  initialIncomingCall?: IncomingCallInfo | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Gestisce la negoziazione WebRTC completa: offerta/risposta SDP, candidati ICE
// (con buffering pre-remoteDescription), media controls e ciclo di vita chiamata.
export function useWebRTC(sendSignaling: SendSignalingFn, options?: UseWebRTCOptions) {
  // ─── State ────────────────────────────────────────────────────────────────
  const initialIncomingCall = options?.initialIncomingCall ?? null
  // Keep sendSignaling in a ref to avoid stale closures inside callbacks
  const sendRef = useRef<SendSignalingFn>(sendSignaling)
  useEffect(() => { sendRef.current = sendSignaling }, [sendSignaling])

  const [callState, setCallState] = useState<CallState>(initialIncomingCall ? 'incoming' : 'idle')
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(initialIncomingCall)
  const [activeCallTargetUserId, setActiveCallTargetUserId] = useState<number | null>(null)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [remoteVolume, setRemoteVolume] = useState(1)

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const callIdRef = useRef<string | null>(null)
  const activeTargetRef = useRef<number | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const disconnectCleanupTimerRef = useRef<number | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  // ─── Candidati ICE in attesa di remoteDescription ─────────────────────────
  const flushPendingIceCandidates = useCallback(async () => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return

    if (pendingIceCandidatesRef.current.length === 0) return

    const pending = [...pendingIceCandidatesRef.current]
    pendingIceCandidatesRef.current = []

    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Ignore malformed/outdated candidates and continue with valid ones.
      }
    }
  }, [])

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  // Ferma stream locali, chiude PeerConnection e resetta tutto lo stato.
  const cleanup = useCallback(() => {
    if (disconnectCleanupTimerRef.current != null) {
      window.clearTimeout(disconnectCleanupTimerRef.current)
      disconnectCleanupTimerRef.current = null
    }

    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    pcRef.current?.close()
    pcRef.current = null
    callIdRef.current = null
    activeTargetRef.current = null
    pendingIceCandidatesRef.current = []
    setCallState('idle')
    setActiveCallTargetUserId(null)
    setIncomingCall(null)
    setIsMicEnabled(true)
    setIsCameraEnabled(true)
    setRemoteVolume(1)
  }, [])

  // ─── Creazione PeerConnection ─────────────────────────────────────────────
  // Configura ontrack per ricevere lo stream remoto e onicecandidate per l'invio.
  const createPc = useCallback((toUserId: number, callId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc
    callIdRef.current = callId
    activeTargetRef.current = toUserId

    const remoteStream = new MediaStream()
    remoteStreamRef.current = remoteStream
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.volume = remoteVolume
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        const serializedCandidate = candidate.toJSON() as SerializableIceCandidate
        sendRef.current('ice-candidate', toUserId, { callId, candidate: serializedCandidate })
      }
    }

    pc.ontrack = ({ streams, track }) => {
      // Some browsers dispatch ontrack with an empty streams array.
      // Keep a dedicated MediaStream and attach tracks manually as fallback.
      const fallbackStream = remoteStreamRef.current ?? new MediaStream()
      remoteStreamRef.current = fallbackStream

      if (streams[0]) {
        remoteStreamRef.current = streams[0]
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = streams[0]
        }
      } else {
        if (track) {
          fallbackStream.addTrack(track)
        }
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject == null) {
          remoteVideoRef.current.srcObject = fallbackStream
        }
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = remoteVolume
        void remoteVideoRef.current.play().catch(() => {})
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connecting') {
        if (disconnectCleanupTimerRef.current != null) {
          window.clearTimeout(disconnectCleanupTimerRef.current)
          disconnectCleanupTimerRef.current = null
        }
      }

      if (state === 'connected') {
        if (disconnectCleanupTimerRef.current != null) {
          window.clearTimeout(disconnectCleanupTimerRef.current)
          disconnectCleanupTimerRef.current = null
        }
        setCallState('connected')
      } else if (state === 'disconnected') {
        if (disconnectCleanupTimerRef.current == null) {
          disconnectCleanupTimerRef.current = window.setTimeout(() => {
            cleanup()
          }, 5000)
        }
      } else if (state === 'failed' || state === 'closed') {
        cleanup()
      }
    }

    return pc
  }, [cleanup, remoteVolume])

  // Mantiene il volume del video remoto sincronizzato con lo state React.
  useEffect(() => {
    if (!remoteVideoRef.current) return
    remoteVideoRef.current.volume = remoteVolume
  }, [remoteVolume])

  // Re-aggancia stream locali/remoti ai tag <video> ogni volta che il callState
  // cambia (i ref potrebbero essere null al momento della creazione dello stream).
  useEffect(() => {
    const localVideo = localVideoRef.current
    if (localVideo && localStreamRef.current && localVideo.srcObject !== localStreamRef.current) {
      localVideo.srcObject = localStreamRef.current
      void localVideo.play().catch(() => {})
    }

    const remoteVideo = remoteVideoRef.current
    const streamToAttach = remoteStreamRef.current
    if (remoteVideo && streamToAttach && remoteVideo.srcObject !== streamToAttach) {
      remoteVideo.srcObject = streamToAttach
      remoteVideo.volume = remoteVolume
      void remoteVideo.play().catch(() => {})
    }
  }, [callState, remoteVolume])

  // ─── Azioni chiamata ──────────────────────────────────────────────────────
  const startCall = useCallback(async (toUserId: number) => {
    if (callState !== 'idle') return
    try {
      const callId = crypto.randomUUID()
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      void localVideoRef.current?.play().catch(() => {})

      const pc = createPc(toUserId, callId)
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const serializedOffer: SerializableSessionDescription = {
        type: offer.type,
        sdp: offer.sdp ?? undefined,
      }
      sendRef.current('offer', toUserId, { callId, description: serializedOffer })

      setActiveCallTargetUserId(toUserId)
      setCallState('calling')
    } catch {
      cleanup()
    }
  }, [callState, createPc, cleanup])

  const acceptCall = useCallback(async () => {
    if (!incomingCall || callState !== 'incoming') return
    const { callId, fromUserId, description } = incomingCall
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      void localVideoRef.current?.play().catch(() => {})

      const pc = createPc(fromUserId, callId)
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription(description))
      await flushPendingIceCandidates()
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const serializedAnswer: SerializableSessionDescription = {
        type: answer.type,
        sdp: answer.sdp ?? undefined,
      }
      sendRef.current('answer', fromUserId, { callId, description: serializedAnswer })

      setActiveCallTargetUserId(fromUserId)
      setCallState('connected')
      setIncomingCall(null)
    } catch {
      cleanup()
    }
  }, [incomingCall, callState, createPc, cleanup, flushPendingIceCandidates])

  const rejectCall = useCallback((reason: string = 'rejected') => {
    if (!incomingCall) return
    sendRef.current('hangup', incomingCall.fromUserId, {
      callId: incomingCall.callId,
      reason,
    })
    setIncomingCall(null)
    setCallState('idle')
  }, [incomingCall])

  const hangup = useCallback(() => {
    const targetId = activeTargetRef.current
    const callId = callIdRef.current
    if (targetId != null && callId) {
      sendRef.current('hangup', targetId, { callId, reason: 'hangup' })
    }
    cleanup()
  }, [cleanup])

  const setIncomingCallData = useCallback((call: IncomingCallInfo | null) => {
    setIncomingCall(call)
    if (call) {
      setCallState('incoming')
    } else {
      setCallState('idle')
    }
  }, [])

  // ─── Controlli media ──────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !isMicEnabled
    stream.getAudioTracks().forEach(track => { track.enabled = next })
    setIsMicEnabled(next)
  }, [isMicEnabled])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !isCameraEnabled
    stream.getVideoTracks().forEach(track => { track.enabled = next })
    setIsCameraEnabled(next)
  }, [isCameraEnabled])

  const setCallVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value))
    setRemoteVolume(clamped)
  }, [])

  const toggleFullscreen = useCallback(async (target: FullscreenTarget) => {
    const video = target === 'local' ? localVideoRef.current : remoteVideoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    if (video.requestFullscreen) {
      await video.requestFullscreen()
    }
  }, [])

  // ─── Signaling handler ────────────────────────────────────────────────────
  // Riceve i messaggi signaling dal canale WebSocket e aggiorna lo stato WebRTC.
  const handleSignaling = useCallback((action: string, fromUserId: number, payload: unknown) => {
    const p = payload as Record<string, unknown> | undefined
    const callId = typeof p?.callId === 'string' ? p.callId : ''

    if (action === 'offer') {
      const description = p?.description as RTCSessionDescriptionInit | undefined
      if (!description || !callId) return
      setIncomingCall({ callId, fromUserId, description })
      setCallState('incoming')
      return
    }

    if (action === 'answer') {
      const description = p?.description as RTCSessionDescriptionInit | undefined
      if (!description || !pcRef.current) return
      void pcRef.current
        .setRemoteDescription(new RTCSessionDescription(description))
        .then(async () => {
          await flushPendingIceCandidates()
          setCallState('connected')
        })
      return
    }

    if (action === 'ice-candidate') {
      const candidate = p?.candidate as RTCIceCandidateInit | undefined
      if (!candidate) return

      const pc = pcRef.current
      if (!pc || !pc.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate)
        return
      }

      void pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {
        // Ignore candidate errors that can happen on reconnect/race paths.
      })
      return
    }

    if (action === 'hangup') {
      cleanup()
      return
    }
  }, [cleanup, flushPendingIceCandidates])

  return {
    callState,
    incomingCall,
    activeCallTargetUserId,
    localVideoRef,
    remoteVideoRef,
    isMicEnabled,
    isCameraEnabled,
    remoteVolume,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    setIncomingCallData,
    toggleMic,
    toggleCamera,
    setCallVolume,
    toggleFullscreen,
    handleSignaling,
  }
}
