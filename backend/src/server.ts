import express from "express";
import { join } from "path";
import { corsMiddleware } from "./middleware";
import { registerRoutes } from "./routes";

// ______ Factory che costruisce l'app Express con tutti i middleware e le route ______
// ______ Il sessionMiddleware e' creato in index.ts per essere condiviso con initWebSocket ______
export function createApp(sessionMiddleware: express.RequestHandler) {
  const app = express();

  app.use(corsMiddleware);
  app.use(sessionMiddleware);
  app.use(express.json());
  // ______ Serve i file statici caricati (foto profilo) dalla cartella uploads/ ______
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));
  registerRoutes(app);

  return app;
}
