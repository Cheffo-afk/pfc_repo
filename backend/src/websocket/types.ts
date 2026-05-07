// ______ Canali logici gestiti dal protocollo WebSocket ______
export type WsChannel = "chat" | "presence" | "signaling" | "system";

// ______ Stati presenza supportati lato applicazione ______
export type PresenceStatus = "online" | "offline" | "nonAlComputer";

// ______ Messaggio in ingresso dal client verso il server ______
export type ClientMessage = {
  channel: WsChannel;
  action: string;
  payload?: unknown;
  // ______ Identificatore destinatario per chat/signaling ______
  toUserId?: number;
};

// ______ Messaggio in uscita dal server verso il client ______
export type ServerMessage = {
  channel: WsChannel | "system";
  action: string;
  payload?: unknown;
};
