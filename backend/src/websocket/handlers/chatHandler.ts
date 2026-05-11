import type WebSocket from "ws";
import { prisma } from "../../lib/prisma";
import type { WsContext } from "../context";
import type { ClientMessage, ServerMessage } from "../types";
import {
  getDirectHistoryPage,
  persistDirectMessage,
  markDirectMessagesAsRead,
  HISTORY_LIMIT,
} from "../services/chatRoomService";
import { isOpen } from "../utils";

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

function extractTargetUserId(message: ClientMessage): number | null {
  if (isPositiveInt(message.toUserId)) {
    return message.toUserId;
  }

  return null;
}

function extractTextPayload(payload: unknown): string | null {
  if (typeof payload !== "string") {
    return null;
  }

  const text = payload.trim();
  if (!text) {
    return null;
  }

  return text;
}

function extractBeforeMessageId(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const candidate = payload as Record<string, unknown>;
  if (!isPositiveInt(candidate.beforeMessageId)) {
    return undefined;
  }

  return candidate.beforeMessageId;
}

function resolveConnectedClientId(context: WsContext, userId: number) {
  const preferredClientId = context.userIdToClient.get(userId);
  if (preferredClientId) {
    const preferredSocket = context.clients.get(preferredClientId);
    if (preferredSocket && isOpen(preferredSocket)) {
      return preferredClientId;
    }
  }

  for (const [candidateClientId, mappedUserId] of context.clientToUserId.entries()) {
    if (mappedUserId !== userId) {
      continue;
    }

    const candidateSocket = context.clients.get(candidateClientId);
    if (!candidateSocket || !isOpen(candidateSocket)) {
      continue;
    }

    context.userIdToClient.set(userId, candidateClientId);
    return candidateClientId;
  }

  return null;
}

export function handleChatMessage(
  context: WsContext,
  clientId: string,
  socket: WebSocket,
  message: ClientMessage,
) {
  void (async () => {
    // ______ La chat e' 1-to-1: action supportate = send | history ______
    if (message.action !== "send" && message.action !== "history") {
      send(socket, {
        channel: "chat",
        action: "error",
        payload: { message: "Unsupported chat action" },
      });
      return;
    }

    const fromUsername = context.clientToUsername.get(clientId);
    const fromUserId = context.clientToUserId.get(clientId);
    if (!fromUsername || !fromUserId) {
      send(socket, {
        channel: "chat",
        action: "error",
        payload: { message: "Sender is not bound to a username" },
      });
      return;
    }

    const toUserId = extractTargetUserId(message);
    if (!toUserId) {
      send(socket, {
        channel: "chat",
        action: "error",
        payload: { message: "Missing numeric toUserId" },
      });
      return;
    }

    const toUser = await prisma.userData.findFirst({
      where: {
        userId: toUserId,
        subscribed: "active",
      },
      select: {
        userId: true,
        username: true,
      },
    });

    if (!toUser) {
      send(socket, {
        channel: "chat",
        action: "error",
        payload: { message: "Target userId not found or inactive" },
      });
      return;
    }

    const toUsername = toUser.username;

    if (message.action === "history") {
      // ______ Paginazione a cursore: ogni richiesta torna al massimo 30 messaggi ______
      // ______ precedenti al messageId passato dal client ______
      const beforeMessageId = extractBeforeMessageId(message.payload);
      const rows = await getDirectHistoryPage(
        fromUserId,
        toUser.userId,
        beforeMessageId,
      );

      await markDirectMessagesAsRead(fromUserId, toUser.userId);

      send(socket, {
        channel: "chat",
        action: "history",
        payload: {
          withUsername: toUsername,
          limit: HISTORY_LIMIT,
          hasMore: rows.length === HISTORY_LIMIT,
          beforeMessageId: beforeMessageId ?? null,
          messages: rows.map((row) => ({
            messageId: row.messageId,
            roomId: row.roomId,
            fromUsername: row.sender.username,
            toUsername,
            content: row.content,
            at: row.sentAt.toISOString(),
            readAt: row.readAt ? row.readAt.toISOString() : null,
          })),
        },
      });

      return;
    }

    const content = extractTextPayload(message.payload);
    if (!content) {
      send(socket, {
        channel: "chat",
        action: "error",
        payload: { message: "Invalid message content" },
      });
      return;
    }

    const saved = await persistDirectMessage(fromUserId, toUser.userId, content);

    // ______ Il payload esposto al client contiene solo chiavi tecniche del messaggio ______
    // ______ e dati di display, mai identificatori interni utente ______
    const payload = {
      messageId: saved.messageId,
      roomId: saved.roomId,
      fromUsername,
      toUsername,
      content,
      at: saved.sentAt.toISOString(),
    };

    // ______ Routing 1-to-1 via userId per evitare collisioni su username non unique ______
    const targetClientId = resolveConnectedClientId(context, toUser.userId);
    const targetSocket = targetClientId
      ? context.clients.get(targetClientId)
      : undefined;

    if (targetSocket && isOpen(targetSocket)) {
      send(targetSocket, {
        channel: "chat",
        action: "message",
        payload,
      });
    }

    // ______ Echo to sender to keep local conversation state aligned ______
    send(socket, {
      channel: "chat",
      action: "message",
      payload,
    });
  })().catch(() => {
    send(socket, {
      channel: "chat",
      action: "error",
      payload: { message: "Internal chat error" },
    });
  });
}
