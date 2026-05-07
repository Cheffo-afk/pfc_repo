import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import type {
  AdminCreateUserResponse,
  AdminUserResponse,
} from "../types/responses";
import type { ServiceResult } from "../types/serviceResult";

// ______ Lista tutti gli utenti con ruolo 'user' con anagrafica e stato presenza ______
// ______ Usata dal pannello admin per visualizzare e gestire gli iscritti ______
export async function listAdminUsers(): Promise<AdminUserResponse[]> {
  const users = await prisma.userData.findMany({
    where: { role: "user" },
    select: {
      userId: true,
      email: true,
      username: true,
      role: true,
      subscribed: true,
      mustChangePassword: true,
      createdAt: true,
      anagraphicsRef: {
        select: {
          nome: true,
          cognome: true,
          telefono: true,
          indirizzo: true,
          fotoProfilo: true,
        },
      },
      userStateRef: {
        select: {
          status: true,
          lastOnline: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((user) => ({
    ...user,
    role: "user",
  }));
}

// ______ Crea un utente con password iniziale gia' impostata dall'admin ______
// ______ L'utente e' creato active e con mustChangePassword=true ______
export async function createUserByAdmin(input: {
  email: string;
  username: string;
  initialPassword: string;
}): Promise<ServiceResult<AdminCreateUserResponse, "email_conflict">> {
  const hashedPassword = await bcrypt.hash(input.initialPassword, 12);

  try {
    const created = await prisma.userData.create({
      data: {
        email: input.email,
        username: input.username,
        password: hashedPassword,
        role: "user",
        subscribed: "active",
        mustChangePassword: true,
      },
      select: {
        userId: true,
        email: true,
        username: true,
        role: true,
        mustChangePassword: true,
      },
    });

    return { ok: true, data: { ...created, role: "user" } };
  } catch {
    return { ok: false, reason: "email_conflict" };
  }
}

// ______ Imposta la prima password per un utente registrato tramite form pubblico ______
// ______ Riattiva anche l'account portandolo a subscribed=active ______
export async function setInitialPasswordByAdmin(
  userId: number,
  initialPassword: string,
): Promise<ServiceResult<null, "not_found" | "admin_forbidden">> {
  const targetUser = await prisma.userData.findUnique({
    where: { userId },
    select: { role: true },
  });

  if (!targetUser) {
    return { ok: false, reason: "not_found" };
  }

  if (targetUser.role === "admin") {
    return { ok: false, reason: "admin_forbidden" };
  }

  const hashedPassword = await bcrypt.hash(initialPassword, 12);
  await prisma.userData.update({
    where: { userId },
    data: {
      password: hashedPassword,
      mustChangePassword: true,
      subscribed: "active",
    },
  });

  return { ok: true, data: null };
}

// ______ Soft delete utente: imposta subscribed=inactive ______
// ______ Non e' possibile rimuovere un admin tramite questa API ______
export async function deleteUserByAdmin(
  userId: number,
): Promise<ServiceResult<null, "not_found" | "admin_forbidden" | "already_inactive">> {
  const targetUser = await prisma.userData.findUnique({
    where: { userId },
    select: { role: true, subscribed: true },
  });

  if (!targetUser) {
    return { ok: false, reason: "not_found" };
  }

  if (targetUser.role === "admin") {
    return { ok: false, reason: "admin_forbidden" };
  }

  if (targetUser.subscribed === "inactive") {
    return { ok: false, reason: "already_inactive" };
  }

  await prisma.userData.update({
    where: { userId },
    data: { subscribed: "inactive" },
  });

  return { ok: true, data: null };
}

// ______ Toggle attivazione: active→inactive o inactive→active ______
// ______ Richiede verifica della password admin per autorizzazione aggiuntiva ______
export async function toggleSubscriptionByAdmin(input: {
  userId: number;
  adminUserId: number;
  adminPassword: string;
}): Promise<ServiceResult<"active" | "inactive", "admin_not_found" | "admin_password_invalid" | "target_not_found" | "target_admin_forbidden">> {
  const adminCredentials = await prisma.userData.findUnique({
    where: { userId: input.adminUserId },
    select: { password: true },
  });

  if (!adminCredentials) {
    return { ok: false, reason: "admin_not_found" };
  }

  const adminPasswordOk = await bcrypt.compare(input.adminPassword, adminCredentials.password);
  if (!adminPasswordOk) {
    return { ok: false, reason: "admin_password_invalid" };
  }

  const targetUser = await prisma.userData.findUnique({
    where: { userId: input.userId },
    select: { role: true, subscribed: true },
  });

  if (!targetUser) {
    return { ok: false, reason: "target_not_found" };
  }

  if (targetUser.role === "admin") {
    return { ok: false, reason: "target_admin_forbidden" };
  }

  const nextSubscribed = targetUser.subscribed === "active" ? "inactive" : "active";

  await prisma.userData.update({
    where: { userId: input.userId },
    data: { subscribed: nextSubscribed },
  });

  return { ok: true, data: nextSubscribed };
}

export async function activateUserByAdmin(
  userId: number,
): Promise<ServiceResult<null, "not_found" | "admin_forbidden">> {
  const targetUser = await prisma.userData.findUnique({
    where: { userId },
    select: { role: true },
  });

  if (!targetUser) {
    return { ok: false, reason: "not_found" };
  }

  if (targetUser.role === "admin") {
    return { ok: false, reason: "admin_forbidden" };
  }

  await prisma.userData.update({
    where: { userId },
    data: {
      subscribed: "active",
      mustChangePassword: true,
    },
  });

  return { ok: true, data: null };
}
