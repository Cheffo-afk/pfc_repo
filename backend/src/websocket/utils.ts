import WebSocket from "ws";

// ______ Verifica se il socket e' pronto per inviare dati ______
export function isOpen(socket: WebSocket) {
  return socket.readyState === WebSocket.OPEN;
}

// ______ Parse JSON sicuro: ritorna null se il payload non e' valido ______
export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
