import type WebSocket from "ws";
import type { WsContext } from "../context";
import type {
  ClientMessage,
  PresenceStatus,
  ServerMessage,
} from "../types";
import { isOpen } from "../utils";
import { upsertUserState } from "../services/userStateService";

// ______ Whitelist stati presenza accettati dal server ______
const allowedStatuses: ReadonlyArray<PresenceStatus> = [
  "online",
  "offline",
  "nonAlComputer",
];

// ______ Invia un messaggio al socket solo se la connessione e' aperta ______
function send(socket: WebSocket, message: ServerMessage) {
  if (!isOpen(socket)) {
    return;
  }

  socket.send(JSON.stringify(message));
}

// ______ Type guard per payload presenza ______
function isPresenceStatus(value: unknown): value is PresenceStatus {
  return (
    typeof value === "string" &&
    allowedStatuses.includes(value as PresenceStatus)
  );
}

function getStatusPriority(status: PresenceStatus) {
  if (status === "online") return 3;
  if (status === "nonAlComputer") return 2;
  return 1;
}

function getAggregatedUserStatus(
  context: WsContext,
  userId: number,
  excludeClientId?: string,
): PresenceStatus {
  let best: PresenceStatus | null = null;

  for (const [mappedClientId, mappedUserId] of context.clientToUserId.entries()) {
    if (mappedUserId !== userId) {
      continue;
    }

    if (excludeClientId && mappedClientId === excludeClientId) {
      continue;
    }

    const candidate = context.statuses.get(mappedClientId) ?? "offline";
    if (!best || getStatusPriority(candidate) > getStatusPriority(best)) {
      best = candidate;
    }
  }

  return best ?? "offline";
}

function buildPublicPresenceSnapshot(context: WsContext) {
  const byUsername = new Map<string, PresenceStatus>();

  for (const [clientId, status] of context.statuses.entries()) {
    const username = context.clientToUsername.get(clientId);
    if (!username) {
      continue;
    }

    const previous = byUsername.get(username);
    if (!previous || getStatusPriority(status) > getStatusPriority(previous)) {
      byUsername.set(username, status);
    }
  }

  return Array.from(byUsername.entries()).map(([username, status]) => ({
    username,
    status,
  }));
}

function broadcastStatuses(context: WsContext) {
  // ______ Expose only public presence data ______
  const users = buildPublicPresenceSnapshot(context);

  context.clients.forEach((clientSocket) => {
    send(clientSocket, {
      channel: "presence",
      action: "snapshot",
      payload: { users },
    });
  });
}

export async function handlePresenceMessage(
  context: WsContext,
  clientId: string,
  socket: WebSocket,
  message: ClientMessage,
) {
  // ______ Aggiornamento esplicito stato presenza utente ______
  if (message.action === "set-status") {
    if (!isPresenceStatus(message.payload)) {
      send(socket, {
        channel: "presence",
        action: "error",
        payload: { message: "Invalid presence status" },
      });
      return;
    }

    context.statuses.set(clientId, message.payload);
    // ______ Persist user presence when the socket is mapped to a real user ______
    const userId = context.clientToUserId.get(clientId);
    if (userId) {
      const aggregate = getAggregatedUserStatus(context, userId);
      await upsertUserState(userId, aggregate);
    }
    broadcastStatuses(context);
    return;
  }

  // ______ Richiesta snapshot dello stato utenti online/offline ______
  if (message.action === "snapshot") {
    const users = buildPublicPresenceSnapshot(context);

    send(socket, {
      channel: "presence",
      action: "snapshot",
      payload: { users },
    });
    return;
  }

  send(socket, {
    channel: "presence",
    action: "error",
    payload: { message: "Unsupported presence action" },
  });
}

export async function markClientOnline(context: WsContext, clientId: string) {
  // ______ All'apertura/bind: marca online in memoria e DB ______
  context.statuses.set(clientId, "online");
  const userId = context.clientToUserId.get(clientId);
  if (userId) {
    const aggregate = getAggregatedUserStatus(context, userId);
    await upsertUserState(userId, aggregate);
  }
  broadcastStatuses(context);
}

export async function markClientOffline(context: WsContext, clientId: string) {
  // ______ Alla chiusura connessione: marca offline in memoria e DB ______
  context.statuses.set(clientId, "offline");
  const userId = context.clientToUserId.get(clientId);
  if (userId) {
    const aggregate = getAggregatedUserStatus(context, userId, clientId);
    await upsertUserState(userId, aggregate);
  }
  broadcastStatuses(context);
}
