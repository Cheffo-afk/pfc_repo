import { Server as HttpServer } from "http";
import { randomUUID } from "crypto";
import { WebSocketServer } from "ws";
import type { Request, RequestHandler, Response } from "express";
import { SubscriptionStatus } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { handleChatMessage } from "./handlers/chatHandler";
import {
  handlePresenceMessage,
  markClientOffline,
  markClientOnline,
} from "./handlers/presenceHandler";
import { handleSignalingMessage } from "./handlers/signalingHandler";
import type { WsContext } from "./context";
import type { ClientMessage } from "./types";
import { isOpen, safeJsonParse } from "./utils";

// ______ Valida che il payload minimo del messaggio client sia presente ______
function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.channel === "string" &&
    typeof candidate.action === "string"
  );
}

// ______ Collega un socket a un utente reale del database ______
// ______ Controlla anche che l'utente non sia disattivato (subscribed = inactive) ______
async function bindSocketToUser(
  context: WsContext,
  clientId: string,
  userId: number,
) {
  // ______ Recupera solo i dati necessari al bind ______
  const user = await prisma.userData.findUnique({
    where: { userId },
    select: {
      userId: true,
      username: true,
      subscribed: true,
    },
  });

  if (!user) {
    return { ok: false as const, reason: "User not found" };
  }

  // ______ Utente non riattivabile da frontend: blocca il bind realtime ______
  if (user.subscribed === SubscriptionStatus.inactive) {
    return {
      ok: false as const,
      reason: "Subscription inactive. Reactivation is DB-only.",
    };
  }

  // ______ Se l'utente aveva una vecchia sessione socket, pulisce i mapping precedenti ______
  const previousClientId = context.userIdToClient.get(user.userId);
  if (previousClientId && previousClientId !== clientId) {
    context.clientToUserId.delete(previousClientId);
    context.clientToUsername.delete(previousClientId);
  }

  // ______ Salva mapping interni per routing e lookup veloce ______
  context.clientToUserId.set(clientId, user.userId);
  context.userIdToClient.set(user.userId, clientId);
  context.clientToUsername.set(clientId, user.username);

  // ______ Una volta bindato, l'utente e' online ______
  await markClientOnline(context, clientId);

  return {
    ok: true as const,
    data: {
      username: user.username,
      status: "online",
    },
  };
}

export function initWebSocket(
  server: HttpServer,
  sessionMiddleware: RequestHandler,
) {
  // ______ WebSocket server agganciato allo stesso server HTTP dell'app ______
  const wss = new WebSocketServer({ server, path: "/ws" });
  // ______ In-memory realtime context for active sockets and user mappings ______
  const context: WsContext = {
    clients: new Map(),
    statuses: new Map(),
    clientToUserId: new Map(),
    userIdToClient: new Map(),
    clientToUsername: new Map(),
  };

  wss.on("connection", (socket, request) => {
    // ______ clientId interno usato solo lato server (mai esposto nei payload pubblici) ______
    const clientId = randomUUID();
    context.clients.set(clientId, socket);

    sessionMiddleware(request as Request, {} as Response, () => {
      void (async () => {
        const sessionUser = (request as Request).session.authUser;
        if (!sessionUser) {
          if (isOpen(socket)) {
            socket.send(
              JSON.stringify({
                channel: "system",
                action: "error",
                payload: { message: "Unauthorized websocket session" },
              }),
            );
          }
          context.clients.delete(clientId);
          socket.close();
          return;
        }

        const bindResult = await bindSocketToUser(context, clientId, sessionUser.userId);
        if (!bindResult.ok) {
          if (isOpen(socket)) {
            socket.send(
              JSON.stringify({
                channel: "system",
                action: "error",
                payload: { message: bindResult.reason },
              }),
            );
          }
          context.clients.delete(clientId);
          socket.close();
          return;
        }

        if (isOpen(socket)) {
          socket.send(
            JSON.stringify({
              channel: "system",
              action: "bound",
              payload: bindResult.data,
            }),
          );
        }
      })().catch(() => {
        if (isOpen(socket)) {
          socket.send(
            JSON.stringify({
              channel: "system",
              action: "error",
              payload: { message: "Internal websocket auth error" },
            }),
          );
        }
        context.clients.delete(clientId);
        socket.close();
      });
    });

    socket.on("message", (raw) => {
      void (async () => {
        // ______ Parse + validazione base del messaggio ricevuto ______
        const parsed = safeJsonParse(String(raw));
        if (!isClientMessage(parsed)) {
          if (isOpen(socket)) {
            socket.send(
              JSON.stringify({
                channel: "system",
                action: "error",
                payload: { message: "Invalid message format" },
              }),
            );
          }
          return;
        }

        const mappedUserId = context.clientToUserId.get(clientId);
        // ______ Tutti i canali applicativi richiedono socket gia' bindato ______
        if (!mappedUserId) {
          if (isOpen(socket)) {
            socket.send(
              JSON.stringify({
                channel: "system",
                action: "error",
                payload: { message: "Socket not bound to user session" },
              }),
            );
          }
          return;
        }

        // ______ Router canali websocket verso i rispettivi handler ______
        if (parsed.channel === "chat") {
          handleChatMessage(context, clientId, socket, parsed);
          return;
        }

        if (parsed.channel === "presence") {
          await handlePresenceMessage(context, clientId, socket, parsed);
          return;
        }

        if (parsed.channel === "signaling") {
          handleSignalingMessage(context, clientId, socket, parsed);
          return;
        }

        if (isOpen(socket)) {
          socket.send(
            JSON.stringify({
              channel: "system",
              action: "error",
              payload: { message: "Unsupported channel" },
            }),
          );
        }
      })().catch(() => {
        // ______ Errore generico runtime durante la gestione del messaggio ______
        if (isOpen(socket)) {
          socket.send(
            JSON.stringify({
              channel: "system",
              action: "error",
              payload: { message: "Internal websocket error" },
            }),
          );
        }
      });
    });

    socket.on("close", () => {
      void (async () => {
        // ______ Rimuove socket attivo e persiste stato offline ______
        context.clients.delete(clientId);
        await markClientOffline(context, clientId);

        const mappedUserId = context.clientToUserId.get(clientId);
        if (mappedUserId) {
          context.userIdToClient.delete(mappedUserId);
        }

        // ______ Pulisce tutte le mappe runtime legate al client scollegato ______
        context.clientToUserId.delete(clientId);
        context.clientToUsername.delete(clientId);
        context.statuses.delete(clientId);
      })().catch(() => {
        // ______ Connection is already closed; avoid throwing from async cleanup ______
      });
    });
  });

  return wss;
}
