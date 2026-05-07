import type WebSocket from "ws";
import type { WsContext } from "../context";
import type { ClientMessage, ServerMessage } from "../types";
import { isOpen } from "../utils";

type SignalingAction = "offer" | "answer" | "ice-candidate" | "hangup";

type NormalizedSignalingPayload = {
  callId: string;
  description?: unknown;
  candidate?: unknown;
  reason?: string;
};

// ______ Invia un messaggio al socket solo se la connessione e' aperta ______
function send(socket: WebSocket, message: ServerMessage) {
  if (!isOpen(socket)) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isSignalingAction(value: string): value is SignalingAction {
  return ["offer", "answer", "ice-candidate", "hangup"].includes(value);
}

function normalizeSignalingPayload(
  action: SignalingAction,
  payload: unknown,
): NormalizedSignalingPayload | null {
  // ______ Il signaling inoltra solo metadati tecnici strettamente necessari alla ______
  // ______ negoziazione WebRTC; nessun identificatore applicativo viene esposto ______
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.callId !== "string" || !candidate.callId.trim()) {
    return null;
  }

  const normalized: NormalizedSignalingPayload = {
    callId: candidate.callId.trim(),
  };

  if (action === "offer" || action === "answer") {
    if (typeof candidate.description === "undefined") {
      return null;
    }
    normalized.description = candidate.description;
  }

  if (action === "ice-candidate") {
    if (typeof candidate.candidate === "undefined") {
      return null;
    }
    normalized.candidate = candidate.candidate;
  }

  if (action === "hangup" && typeof candidate.reason === "string") {
    normalized.reason = candidate.reason;
  }

  return normalized;
}

export function handleSignalingMessage(
  context: WsContext,
  clientId: string,
  socket: WebSocket,
  message: ClientMessage,
) {
  if (!isSignalingAction(message.action)) {
    send(socket, {
      channel: "signaling",
      action: "error",
      payload: { message: "Unsupported signaling action" },
    });
    return;
  }

  // ______ Signaling 1-to-1 (offer/answer/ice) instradato per userId ______
  if (!isPositiveInt(message.toUserId)) {
    send(socket, {
      channel: "signaling",
      action: "error",
      payload: { message: "Missing numeric toUserId" },
    });
    return;
  }

  const toUserId = message.toUserId;
  // ______ Mittente risolto dal mapping interno del socket ______
  const fromUserId = context.clientToUserId.get(clientId);
  if (!fromUserId) {
    send(socket, {
      channel: "signaling",
      action: "error",
      payload: { message: "Sender is not bound to a user" },
    });
    return;
  }

  const normalizedPayload = normalizeSignalingPayload(
    message.action,
    message.payload,
  );
  if (!normalizedPayload) {
    send(socket, {
      channel: "signaling",
      action: "error",
      payload: { message: "Invalid signaling payload" },
    });
    return;
  }

  // ______ Destinatario risolto su mappa userId -> client attivo ______
  const targetClientId = context.userIdToClient.get(toUserId);
  if (!targetClientId) {
    send(socket, {
      channel: "signaling",
      action: "error",
      payload: { message: "Target userId not connected" },
    });
    return;
  }

  const targetSocket = context.clients.get(targetClientId);
  if (!targetSocket || !isOpen(targetSocket)) {
    send(socket, {
      channel: "signaling",
      action: "error",
      payload: { message: "Target userId not connected" },
    });
    return;
  }

  send(targetSocket, {
    channel: "signaling",
    action: message.action,
     payload: { ...normalizedPayload, fromUserId },
  });
}
