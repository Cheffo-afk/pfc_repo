import { PrismaClient } from "../generated/prisma/client";

// ______ Client Prisma condiviso in tutto il processo ______
// ______ Evita di creare connessioni multiple inutili al database ______
export const prisma = new PrismaClient();
