import type express from "express";
import { prisma } from "../lib/prisma";

// ______ Legge l'utente dalla sessione corrente ______
// ______ Risponde 401 e ritorna null se la sessione non e' valida o scaduta ______
export function getSessionUser(req: express.Request, res: express.Response) {
  const user = req.session.authUser;
  if (!user) {
    res.status(401).json({ error: "Sessione non valida o scaduta" });
    return null;
  }

  return user;
}

// ______ Verifica che l'utente sia autenticato E abbia ruolo admin ______
// ______ Esegue anche un controllo DB per assicurarsi che l'account sia attivo ______
export async function requireAdmin(req: express.Request, res: express.Response) {
  const sessionUser = getSessionUser(req, res);
  if (!sessionUser) {
    return null;
  }

  if (sessionUser.role !== "admin") {
    res.status(403).json({ error: "Privilegi amministrativi richiesti" });
    return null;
  }

  const adminUser = await prisma.userData.findFirst({
    where: {
      userId: sessionUser.userId,
      role: "admin",
      subscribed: "active",
    },
    select: {
      userId: true,
    },
  });

  if (!adminUser) {
    res.status(403).json({ error: "Utente senza privilegi amministrativi" });
    return null;
  }

  return adminUser;
}
