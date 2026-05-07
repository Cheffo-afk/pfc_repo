import type express from "express";
import { adminRoutes } from "./adminRoutes";
import { authRoutes } from "./authRoutes";
import { healthRoutes } from "./healthRoutes";
import { userRoutes } from "./userRoutes";

// ______ Registra tutti i router sull'app Express ______
// ______ L'ordine non e' critico: ogni router gestisce prefissi distinti ______
export function registerRoutes(app: express.Express) {
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(userRoutes);
  app.use(adminRoutes);
}
