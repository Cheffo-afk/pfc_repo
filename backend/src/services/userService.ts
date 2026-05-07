import { prisma } from "../lib/prisma";
import type { PublicUserResponse } from "../types/responses";
import type { ServiceResult } from "../types/serviceResult";

// ______ Lista gli utenti attivi (subscribed=active) ordinati per username ______
// ______ Usata dalla chat per popolare il pannello utenti ______
export async function listActiveUsers(): Promise<PublicUserResponse[]> {
  return prisma.userData.findMany({
    where: {
      subscribed: "active",
    },
    select: {
      userId: true,
      username: true,
      email: true,
      mustChangePassword: true,
      createdAt: true,
      anagraphicsRef: {
        select: {
          nome: true,
          cognome: true,
          fotoProfilo: true,
        },
      },
    },
    orderBy: { username: "asc" },
  });
}

// ______ Soft delete: porta subscribed=inactive senza rimuovere i dati ______
export async function unsubscribeUserById(
  userId: number,
): Promise<ServiceResult<null, "not_found" | "already_inactive">> {
  const user = await prisma.userData.findUnique({
    where: { userId },
    select: { subscribed: true },
  });

  if (!user) {
    return { ok: false, reason: "not_found" };
  }

  if (user.subscribed === "inactive") {
    return { ok: false, reason: "already_inactive" };
  }

  await prisma.userData.update({
    where: { userId },
    data: { subscribed: "inactive" },
  });

  return { ok: true, data: null };
}

// ______ Aggiorna il path della foto profilo nell'anagrafica utente ______
// ______ Crea l'anagrafica con valori placeholder se non esiste ancora ______
export async function updateProfilePicture(userId: number, relativePath: string): Promise<boolean> {
  const user = await prisma.userData.findUnique({
    where: { userId },
    select: { userId: true },
  });

  if (!user) {
    return false;
  }

  await prisma.anagraphics.upsert({
    where: { userId },
    update: { fotoProfilo: relativePath },
    create: {
      userId,
      nome: "N/A",
      cognome: "N/A",
      fotoProfilo: relativePath,
    },
  });

  return true;
}

// ______ Normalizza stringhe vuote a null per i campi opzionali del profilo ______
function toNullableString(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ______ Aggiorna username, telefono e indirizzo dell'utente loggato ______
// ______ Fa upsert sull'anagrafica per gestire il caso in cui non esista ancora ______
export async function updateOwnProfile(input: {
  userId: number;
  username: string;
  telefono?: string | null;
  indirizzo?: string | null;
}): Promise<ServiceResult<null, "not_found">> {
  const user = await prisma.userData.findUnique({
    where: { userId: input.userId },
    select: { userId: true },
  });

  if (!user) {
    return { ok: false, reason: "not_found" };
  }

  const normalizedTelefono = toNullableString(input.telefono);
  const normalizedIndirizzo = toNullableString(input.indirizzo);

  await prisma.userData.update({
    where: { userId: input.userId },
    data: {
      username: input.username.trim(),
      anagraphicsRef: {
        upsert: {
          update: {
            telefono: normalizedTelefono,
            indirizzo: normalizedIndirizzo,
          },
          create: {
            nome: "N/A",
            cognome: "N/A",
            telefono: normalizedTelefono,
            indirizzo: normalizedIndirizzo,
            fotoProfilo: "default-profile.png",
          },
        },
      },
    },
  });

  return { ok: true, data: null };
}
