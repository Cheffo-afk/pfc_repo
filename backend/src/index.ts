import "dotenv/config";
import http from "http";
import session from "express-session";
import { ensureAdminUser } from "./admin/bootstrapAdmin";
import { createApp } from "./server";
import { initWebSocket } from "./websocket/initWebSocket";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "sid";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "change-this-session-secret";
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS ?? 1000 * 60 * 60 * 24 * 7);

const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
  },
});

  // ______ Crea l'app Express con middleware e route HTTP ______
const app = createApp(sessionMiddleware);
  // ______ Porta di avvio del backend (default 3000) ______
const port = Number(process.env.PORT || 3000);

  // ______ Usa un server HTTP unico per servire sia REST che WebSocket ______
const server = http.createServer(app);
  // ______ Aggancia il layer realtime al server HTTP ______
initWebSocket(server, sessionMiddleware);

async function bootstrap() {
    // ______ Bootstrap amministratore e avvio backend ______
  await ensureAdminUser();
  server.listen(port, () => {
    process.stdout.write(`Backend in ascolto su http://localhost:${port}\n`);
  });
}

void bootstrap();
