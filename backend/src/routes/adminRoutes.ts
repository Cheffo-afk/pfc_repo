import { Router } from "express";
import { parseBody, requireAdmin } from "../middleware";
import {
  activateUserByAdmin,
  createUserByAdmin,
  deleteUserByAdmin,
  listAdminUsers,
  setInitialPasswordByAdmin,
  toggleSubscriptionByAdmin,
} from "../services";
import type {
  AdminCreateUserResponse,
  ApiMessageResponse,
  ToggleSubscriptionResponse,
} from "../types";
import {
  AdminCreateUserSchema,
  InitialPasswordSchema,
  ToggleSubscriptionSchema,
} from "../validation/schemas";

const adminRoutes = Router();

// ______ Helper per parsing userId da path param ______
function parseUserIdParam(rawUserId: string | string[] | undefined) {
  if (typeof rawUserId !== "string") {
    return Number.NaN;
  }

  return Number.parseInt(rawUserId, 10);
}

// ______ GET /admin/users — lista tutti gli utenti (solo admin) ______
adminRoutes.get("/admin/users", (req, res) => {
  void (async () => {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) {
      return;
    }

    const users = await listAdminUsers();

    res.status(200).json(users);
  })();
});

// ______ POST /admin/users — crea utente con password iniziale (solo admin) ______
adminRoutes.post("/admin/users", (req, res) => {
  void (async () => {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) {
      return;
    }

    const body = parseBody(AdminCreateUserSchema, req.body, res);
    if (!body) return;
    const created = await createUserByAdmin(body);
    if (!created.ok) {
      res.status(409).json({ error: "Impossibile creare utente (email duplicata?)" });
      return;
    }

    res.status(201).json(created.data as AdminCreateUserResponse);
  })();
});

// ______ PATCH /admin/users/:userId/initial-password — imposta la prima password (solo admin) ______
// ______ Riattiva anche l'utente portandolo a subscribed=active ______
adminRoutes.patch("/admin/users/:userId/initial-password", (req, res) => {
  void (async () => {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) {
      return;
    }

    const userId = parseUserIdParam(req.params.userId);
    if (Number.isNaN(userId) || userId <= 0) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    const body = parseBody(InitialPasswordSchema, req.body, res);
    if (!body) return;
    const changed = await setInitialPasswordByAdmin(userId, body.initialPassword);
    if (!changed.ok && changed.reason === "not_found") {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    if (!changed.ok && changed.reason === "admin_forbidden") {
      res.status(403).json({ error: "Password dell'admin non modificabile da questa API" });
      return;
    }

    const response: ApiMessageResponse = { ok: true, message: "Prima password impostata" };
    res.status(200).json(response);
  })();
});

// ______ DELETE /admin/users/:userId — soft delete utente (solo admin) ______
adminRoutes.delete("/admin/users/:userId", (req, res) => {
  void (async () => {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) {
      return;
    }

    const userId = parseUserIdParam(req.params.userId);
    if (Number.isNaN(userId) || userId <= 0) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    const deleted = await deleteUserByAdmin(userId);
    if (!deleted.ok && deleted.reason === "not_found") {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    if (!deleted.ok && deleted.reason === "admin_forbidden") {
      res.status(403).json({ error: "Non puoi rimuovere un amministratore" });
      return;
    }

    if (!deleted.ok && deleted.reason === "already_inactive") {
      res.status(409).json({ error: "Utente gia' disattivato" });
      return;
    }

    const response: ApiMessageResponse = { ok: true, message: "Utente rimosso (soft delete)" };
    res.status(200).json(response);
  })();
});

// ______ PATCH /admin/users/:userId/subscription — toggle attivazione/disattivazione (solo admin) ______
// ______ Richiede conferma della password admin per autorizzazione aggiuntiva ______
adminRoutes.patch("/admin/users/:userId/subscription", (req, res) => {
  void (async () => {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) {
      return;
    }

    const userId = parseUserIdParam(req.params.userId);
    if (Number.isNaN(userId) || userId <= 0) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    const body = parseBody(ToggleSubscriptionSchema, req.body, res);
    if (!body) return;
    const toggled = await toggleSubscriptionByAdmin({
      userId,
      adminUserId: adminUser.userId,
      adminPassword: body.adminPassword,
    });

    if (!toggled.ok && toggled.reason === "admin_not_found") {
      res.status(403).json({ error: "Amministratore non valido" });
      return;
    }

    if (!toggled.ok && toggled.reason === "admin_password_invalid") {
      res.status(401).json({ error: "Password amministratore non valida" });
      return;
    }

    if (!toggled.ok && toggled.reason === "target_not_found") {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    if (!toggled.ok && toggled.reason === "target_admin_forbidden") {
      res.status(403).json({ error: "Non puoi modificare lo stato di un amministratore" });
      return;
    }

    if (!toggled.ok) {
      res.status(500).json({ error: "Errore durante aggiornamento stato utente" });
      return;
    }

    const response: ToggleSubscriptionResponse = {
      ok: true,
      subscribed: toggled.data,
      message:
        toggled.data === "inactive"
          ? "Utente disattivato (soft delete)"
          : "Utente riattivato",
    };

    res.status(200).json(response);
  })();
});

// ______ POST /admin/users/:userId/activate — attivazione account registrato in attesa ______
adminRoutes.post("/admin/users/:userId/activate", (req, res) => {
  void (async () => {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) {
      return;
    }

    const userId = parseUserIdParam(req.params.userId);
    if (Number.isNaN(userId) || userId <= 0) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    const activated = await activateUserByAdmin(userId);
    if (!activated.ok && activated.reason === "not_found") {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    if (!activated.ok && activated.reason === "admin_forbidden") {
      res.status(403).json({ error: "Non puoi attivare un amministratore" });
      return;
    }

    const response: ApiMessageResponse = {
      ok: true,
      message: "Utente attivato e richiede cambio password",
    };

    res.status(200).json(response);
  })();
});

export { adminRoutes };
