import type WebSocket from "ws";
import type { PresenceStatus } from "./types";

// ______ Runtime-only state for active websocket connections ______
export type WsContext = {
  // ______ clientId -> socket attivo ______
  clients: Map<string, WebSocket>;
  // ______ clientId -> stato presenza corrente ______
  statuses: Map<string, PresenceStatus>;
  // ______ clientId -> userId (interno, mai esposto ai client) ______
  clientToUserId: Map<string, number>;
  // ______ userId -> clientId preferito (puo' esistere piu' di un socket per userId) ______
  userIdToClient: Map<number, string>;
  // ______ clientId -> username pubblico ______
  clientToUsername: Map<string, string>;
};
