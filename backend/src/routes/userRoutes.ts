import { Router } from "express";
import multer from "multer";
import { mkdir } from "fs/promises";
import { join } from "path";
import { registerRequestHandler } from "../auth/handlers";
import { parseBody, getSessionUser } from "../middleware";
import {
  listActiveUsers,
  unsubscribeUserById,
  updateProfilePicture,
  updateOwnProfile,
} from "../services";
import { UpdateOwnProfileSchema } from "../validation/schemas";
import type {
  ApiMessageResponse,
  ProfilePictureUploadResponse,
} from "../types/responses";

const userRoutes = Router();

// ______ Helper per parsing userId da path param ______
function parseUserIdParam(rawUserId: string | string[] | undefined) {
  if (typeof rawUserId !== "string") {
    return Number.NaN;
  }

  return Number.parseInt(rawUserId, 10);
}

// ______ Multer: upload foto profilo, solo immagini, max 5MB ______
// ______ Salva il file in uploads/profiles/ con nome univoco basato su timestamp ______
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const profilesDir = join(process.cwd(), "uploads", "profiles");
      await mkdir(profilesDir, { recursive: true });
      cb(null, profilesDir);
    },
    filename: (_req, file, cb) => {
      const ext = file.originalname.split(".").pop() || "jpg";
      cb(null, `user_${Date.now()}.${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo immagini consentite"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ______ POST /users — registrazione utente (accesso pubblico, nessuna sessione) ______
userRoutes.post("/users", (req, res) => {
  void registerRequestHandler(req, res);
});

// ______ GET /users — lista utenti attivi (usata dalla chat per il pannello utenti) ______
userRoutes.get("/users", (req, res) => {
  void (async () => {
    const users = await listActiveUsers();

    res.status(200).json(users);
  })();
});

// ______ POST /users/:userId/unsubscribe — disattivazione account utente ______
userRoutes.post("/users/:userId/unsubscribe", (req, res) => {
  void (async () => {
    const userId = parseUserIdParam(req.params.userId);

    if (Number.isNaN(userId)) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    const unsubscribed = await unsubscribeUserById(userId);
    if (!unsubscribed.ok && unsubscribed.reason === "not_found") {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    if (!unsubscribed.ok && unsubscribed.reason === "already_inactive") {
      res.status(409).json({ error: "Utente gia' disattivato" });
      return;
    }

    const response: ApiMessageResponse = { ok: true, message: "Disiscrizione completata" };
    res.status(200).json(response);
  })();
});

// ______ POST /users/:userId/profile-picture — upload foto profilo ______
userRoutes.post("/users/:userId/profile-picture", upload.single("file"), (req, res) => {
  void (async () => {
    const userId = parseUserIdParam(req.params.userId);
    if (Number.isNaN(userId) || userId <= 0) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "File richiesto" });
      return;
    }

    const relativePath = `/uploads/profiles/${req.file.filename}`;

    const updated = await updateProfilePicture(userId, relativePath);
    if (!updated) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    const response: ProfilePictureUploadResponse = {
      ok: true,
      path: relativePath,
      message: "Foto profilo aggiornata",
    };

    res.status(200).json(response);
  })();
});

// ______ PATCH /users/me/profile — aggiornamento profilo dell'utente loggato ______
// ______ Richiede sessione valida (verificata via getSessionUser) ______
userRoutes.patch("/users/me/profile", (req, res) => {
  void (async () => {
    const sessionUser = getSessionUser(req, res);
    if (!sessionUser) {
      return;
    }

    const body = parseBody(UpdateOwnProfileSchema, req.body, res);
    if (!body) {
      return;
    }

    const updated = await updateOwnProfile({
      userId: sessionUser.userId,
      username: body.username,
      telefono: body.telefono ?? null,
      indirizzo: body.indirizzo ?? null,
    });

    if (!updated.ok && updated.reason === "not_found") {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    const response: ApiMessageResponse = {
      ok: true,
      message: "Profilo aggiornato con successo",
    };

    res.status(200).json(response);
  })();
});

export { userRoutes };
