import { UserOnlineState } from "../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { PresenceStatus } from "../types";

// ______ Converte lo stato presenza applicativo nell'enum DB ______
function toDbStatus(status: PresenceStatus): UserOnlineState {
  if (status === "nonAlComputer") {
    return UserOnlineState.nonAlComputer;
  }

  if (status === "online") {
    return UserOnlineState.online;
  }

  return UserOnlineState.offline;
}

// ______ Crea o aggiorna lo stato utente persistito in tabella userState ______
export async function upsertUserState(userId: number, status: PresenceStatus) {
  await prisma.userState.upsert({
    where: { userID: userId },
    update: {
      status: toDbStatus(status),
      lastOnline: new Date(),
    },
    create: {
      userID: userId,
      status: toDbStatus(status),
      lastOnline: new Date(),
    },
  });
}
