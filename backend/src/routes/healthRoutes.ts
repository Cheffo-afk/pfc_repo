import dayjs from "dayjs";
import { Router } from "express";

// ______ GET /health — endpoint pubblico usato dallo script di avvio per ______
// ______ verificare che il backend sia pronto prima di avviare il frontend ______
const healthRoutes = Router();

healthRoutes.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    now: dayjs().toISOString(),
  });
});

export { healthRoutes };
