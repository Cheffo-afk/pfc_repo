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

function broadcastStatuses(context: WsContext) {
  // ______ Expose only public presence data ______
  const users = Array.from(context.statuses.entries())
    .map(([clientId, status]) => {
      const username = context.clientToUsername.get(clientId);
      if (!username) {
        return null;
      }

      return {
        username,
        status,
      };
    })
    .filter((entry): entry is { username: string; status: PresenceStatus } =>
      entry !== null,
    );

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
      await upsertUserState(userId, message.payload);
    }
    broadcastStatuses(context);
    return;
  }

  // ______ Richiesta snapshot dello stato utenti online/offline ______
  if (message.action === "snapshot") {
    const users = Array.from(context.statuses.entries())
      .map(([mappedClientId, status]) => {
        const username = context.clientToUsername.get(mappedClientId);
        if (!username) {
          return null;
        }

        return {
          username,
          status,
        };
      })
      .filter((entry): entry is { username: string; status: PresenceStatus } =>
        entry !== null,
      );

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
    await upsertUserState(userId, "online");
  }
  broadcastStatuses(context);
}

export async function markClientOffline(context: WsContext, clientId: string) {
  // ______ Alla chiusura connessione: marca offline in memoria e DB ______
  context.statuses.set(clientId, "offline");
  const userId = context.clientToUserId.get(clientId);
  if (userId) {
    await upsertUserState(userId, "offline");
  }
  broadcastStatuses(context);
}
