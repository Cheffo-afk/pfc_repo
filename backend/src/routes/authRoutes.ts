import { Router } from "express";
import {
  loginHandler,
  logoutHandler,
  meHandler,
  changePasswordHandler,
} from "../auth/handlers";

// ______ Route autenticazione: login, logout, sessione corrente, cambio password ______
// ______ Tutte le route sono pubbliche tranne /auth/me e /auth/change-password ______
// ______ che richiedono una sessione valida (verificata internamente dagli handler) ______
const authRoutes = Router();

authRoutes.post("/auth/login", (req, res) => {
  void loginHandler(req, res);
});

authRoutes.post("/auth/logout", (req, res) => {
  void logoutHandler(req, res);
});

authRoutes.get("/auth/me", (req, res) => {
  void meHandler(req, res);
});

authRoutes.post("/auth/change-password", (req, res) => {
  void changePasswordHandler(req, res);
});

export { authRoutes };
