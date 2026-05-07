import type express from "express";
import { parseBody, getSessionUser } from "../middleware";
import {
  authenticateUser,
  changePasswordForUser,
  createRegisterRequest,
  getMeById,
} from "../services";
import type {
  ApiMessageResponse,
  AuthSessionResponse,
  RegisterRequestResponse,
} from "../types/responses";
import {
  LoginSchema,
  ChangePasswordSchema,
  RegisterRequestSchema,
} from "../validation/schemas";

// ______ POST /auth/login — autentica e scrive userId/ruolo nella sessione ______
export async function loginHandler(req: express.Request, res: express.Response) {
  const body = parseBody(LoginSchema, req.body, res);
  if (!body) return;
  const { email, password } = body;

  const user = await authenticateUser(email, password);
  if (!user) {
    res.status(401).json({ error: "Credenziali non valide" });
    return;
  }

  req.session.authUser = {
    userId: user.userId,
    role: user.role,
    email: user.email,
  };

  const response: AuthSessionResponse = {
    user: {
      userId: user.userId,
      email: user.email,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  };

  res.status(200).json(response);
}

// ______ POST /auth/logout — distrugge la sessione corrente ______
export async function logoutHandler(req: express.Request, res: express.Response) {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Impossibile chiudere la sessione" });
      return;
    }

    const response: ApiMessageResponse = { ok: true, message: "Logout completato" };
    res.clearCookie(process.env.SESSION_COOKIE_NAME ?? "sid");
    res.status(200).json(response);
  });
}

// ______ POST /auth/logout-all — alias di logout (sessione unica, stesso comportamento) ______
export async function logoutAllHandler(req: express.Request, res: express.Response) {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Impossibile chiudere la sessione" });
      return;
    }

    const response: ApiMessageResponse = { ok: true, message: "Sessione revocata" };
    res.clearCookie(process.env.SESSION_COOKIE_NAME ?? "sid");
    res.status(200).json(response);
  });
}

// ______ GET /auth/me — ritorna il profilo completo dell'utente loggato ______
// ______ Include anagrafica (nome, cognome, telefono, indirizzo, fotoProfilo) ______
export async function meHandler(req: express.Request, res: express.Response) {
  const sessionUser = getSessionUser(req, res);
  if (!sessionUser) {
    return;
  }

  const me = await getMeById(sessionUser.userId);

  if (!me) {
    res.status(401).json({ error: "Utente non valido o inattivo" });
    return;
  }

  res.status(200).json(me);
}

// ______ POST /auth/change-password — cambia password verificando quella attuale ______
// ______ Imposta mustChangePassword=false dopo il cambio riuscito ______
export async function changePasswordHandler(req: express.Request, res: express.Response) {
  const sessionUser = getSessionUser(req, res);
  if (!sessionUser) {
    return;
  }

  const body = parseBody(ChangePasswordSchema, req.body, res);
  if (!body) return;
  const { currentPassword, newPassword } = body;

  const changed = await changePasswordForUser(
    sessionUser.userId,
    currentPassword,
    newPassword,
  );

  if (!changed.ok && changed.reason === "user_not_found") {
    res.status(401).json({ error: "Utente non valido o inattivo" });
    return;
  }

  if (!changed.ok && changed.reason === "invalid_current_password") {
    res.status(401).json({ error: "Password corrente non valida" });
    return;
  }

  if (!changed.ok) {
    res.status(500).json({ error: "Errore durante il cambio password" });
    return;
  }

  req.session.authUser = {
    userId: changed.data.userId,
    role: changed.data.role,
    email: changed.data.email,
  };

  const response: AuthSessionResponse = {
    user: {
      userId: changed.data.userId,
      email: changed.data.email,
      username: changed.data.username,
      role: changed.data.role,
      mustChangePassword: changed.data.mustChangePassword,
    },
  };

  res.status(200).json(response);
}

export async function registerRequestHandler(req: express.Request, res: express.Response) {
  const body = parseBody(RegisterRequestSchema, req.body, res);
  if (!body) return;
  const { nome, cognome, username, email } = body;

  const created = await createRegisterRequest({ nome, cognome, username, email });
  if (!created.ok && created.reason === "email_exists") {
    res.status(409).json({ error: "Email gia' registrata" });
    return;
  }

  const response: RegisterRequestResponse = {
    ok: true,
    message: "Richiesta registrata. Attendi l'abilitazione da parte dell'amministratore.",
  };

  res.status(201).json(response);
}
