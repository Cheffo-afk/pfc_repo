import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import type { ServiceResult } from "../types/serviceResult";
import type { AuthUserResponse } from "../types/responses";

// ______ Verifica credenziali email/password e ritorna i dati utente se valide ______
// ______ Ritorna null se l'utente non esiste, e' inattivo o la password e' errata ______
export async function authenticateUser(email: string, password: string): Promise<AuthUserResponse | null> {
  const user = await prisma.userData.findFirst({
    where: {
      email,
      subscribed: "active",
    },
    select: {
      userId: true,
      email: true,
      username: true,
      role: true,
      password: true,
      mustChangePassword: true,
    },
  });

  if (!user) {
    return null;
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    return null;
  }

  return {
    userId: user.userId,
    email: user.email,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

// ______ Recupera il profilo completo per la sessione corrente (GET /auth/me) ______
// ______ Include l'anagrafica con foto profilo per il rendering lato client ______
export async function getMeById(userId: number) {
  return prisma.userData.findFirst({
    where: {
      userId,
      subscribed: "active",
    },
    select: {
      userId: true,
      email: true,
      username: true,
      role: true,
      mustChangePassword: true,
      anagraphicsRef: {
        select: {
          nome: true,
          cognome: true,
          telefono: true,
          indirizzo: true,
          fotoProfilo: true,
        },
      },
    },
  });
}

// ______ Cambia la password verificando prima quella attuale ______
// ______ Imposta mustChangePassword=false dopo il cambio ______
export async function changePasswordForUser(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<ServiceResult<AuthUserResponse, "user_not_found" | "invalid_current_password">> {
  const currentUser = await prisma.userData.findFirst({
    where: {
      userId,
      subscribed: "active",
    },
    select: {
      userId: true,
      email: true,
      username: true,
      password: true,
      role: true,
    },
  });

  if (!currentUser) {
    return { ok: false, reason: "user_not_found" };
  }

  const passwordOk = await bcrypt.compare(currentPassword, currentUser.password);
  if (!passwordOk) {
    return { ok: false, reason: "invalid_current_password" };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.userData.update({
    where: { userId: currentUser.userId },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });

  return {
    ok: true,
    data: {
      userId: currentUser.userId,
      email: currentUser.email,
      username: currentUser.username,
      role: currentUser.role,
      mustChangePassword: false,
    },
  };
}

// ______ Crea la richiesta di registrazione con password placeholder ______
// ______ L'utente e' creato inactive e deve essere attivato da un admin ______
export async function createRegisterRequest(input: {
  nome: string;
  cognome: string;
  username: string;
  email: string;
}): Promise<ServiceResult<null, "email_exists">> {
  const existingByEmail = await prisma.userData.findUnique({
    where: { email: input.email },
    select: { userId: true },
  });

  if (existingByEmail) {
    return { ok: false, reason: "email_exists" };
  }

  const placeholderPassword = await bcrypt.hash(`${Date.now()}_${input.email}`, 12);

  await prisma.userData.create({
    data: {
      email: input.email,
      username: input.username,
      password: placeholderPassword,
      role: "user",
      subscribed: "inactive",
      mustChangePassword: true,
      anagraphicsRef: {
        create: {
          nome: input.nome,
          cognome: input.cognome,
          fotoProfilo: "default-profile.png",
        },
      },
      userStateRef: {
        create: {
          status: "offline",
        },
      },
    },
  });

  return { ok: true, data: null };
}
