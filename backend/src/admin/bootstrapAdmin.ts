import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@local.dev";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "superadmin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMeNow!123";
const BOOTSTRAP_ADMIN_ENABLED = (process.env.BOOTSTRAP_ADMIN_ENABLED ?? "true").toLowerCase() !== "false";

// ______ Garantisce che esista sempre un profilo amministratore con privilegi massimi ______
export async function ensureAdminUser() {
  if (!BOOTSTRAP_ADMIN_ENABLED) {
    return;
  }

  const existing = await prisma.userData.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { userId: true },
  });

  if (existing) {
    // Evita di resettare la password a ogni riavvio; riallinea solo ruolo/stato anagrafico.
    await prisma.userData.update({
      where: { userId: existing.userId },
      data: {
        username: ADMIN_USERNAME,
        role: "admin",
        subscribed: "active",
        mustChangePassword: false,
      },
      select: { userId: true },
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await prisma.userData.create({
    data: {
      email: ADMIN_EMAIL,
      username: ADMIN_USERNAME,
      password: hashedPassword,
      role: "admin",
      subscribed: "active",
      mustChangePassword: false,
    },
    select: {
      userId: true,
    },
  });
}
