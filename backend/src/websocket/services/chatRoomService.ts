import { prisma } from "../../lib/prisma";

type MessageRow = {
  messageId: number;
  senderId: number;
  content: string;
  sentAt: Date;
  readAt: Date | null;
  sender: {
    username: string;
  };
};

const HISTORY_LIMIT = 30;

// ______ Crea (se necessario) e ritorna la stanza direct tra due utenti ______
export async function getOrCreateDirectRoom(
  userAId: number,
  userBId: number,
): Promise<number> {
  const existing = await prisma.chatRoom.findFirst({
    where: {
      roomType: "direct",
      AND: [
        { participants: { some: { userId: userAId } } },
        { participants: { some: { userId: userBId } } },
      ],
    },
    select: { roomId: true },
  });

  if (existing) {
    return existing.roomId;
  }

  const created = await prisma.chatRoom.create({
    data: {
      roomType: "direct",
      participants: {
        create: [{ userId: userAId }, { userId: userBId }],
      },
    },
    select: { roomId: true },
  });

  return created.roomId;
}

// ______ Salva un nuovo messaggio nella stanza direct tra due utenti ______
export async function persistDirectMessage(
  fromUserId: number,
  toUserId: number,
  content: string,
): Promise<{ messageId: number; roomId: number; sentAt: Date }> {
  const roomId = await getOrCreateDirectRoom(fromUserId, toUserId);

  const saved = await prisma.roomMessage.create({
    data: {
      roomId,
      senderId: fromUserId,
      content,
    },
    select: {
      messageId: true,
      roomId: true,
      sentAt: true,
    },
  });

  return saved;
}

// ______ Conta i messaggi non letti in una direct conversation ______
export async function countUnreadDirectMessages(
  readerUserId: number,
  otherUserId: number,
): Promise<number> {
  const room = await prisma.chatRoom.findFirst({
    where: {
      roomType: "direct",
      AND: [
        { participants: { some: { userId: readerUserId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
    select: { roomId: true },
  });

  if (!room) {
    return 0;
  }

  return prisma.roomMessage.count({
    where: {
      roomId: room.roomId,
      senderId: otherUserId,
      readAt: null,
    },
  });
}

// ______ Segna come letti i messaggi dell'altro utente nella direct conversation ______
export async function markDirectMessagesAsRead(
  readerUserId: number,
  otherUserId: number,
): Promise<number> {
  const room = await prisma.chatRoom.findFirst({
    where: {
      roomType: "direct",
      AND: [
        { participants: { some: { userId: readerUserId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
    select: { roomId: true },
  });

  if (!room) {
    return 0;
  }

  const result = await prisma.roomMessage.updateMany({
    where: {
      roomId: room.roomId,
      senderId: otherUserId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return result.count;
}

// ______ Ritorna fino a 30 messaggi, ordinati dal piu' vecchio al piu' recente ______
export async function getDirectHistoryPage(
  userAId: number,
  userBId: number,
  beforeMessageId?: number,
): Promise<Array<MessageRow & { roomId: number }>> {
  const room = await prisma.chatRoom.findFirst({
    where: {
      roomType: "direct",
      AND: [
        { participants: { some: { userId: userAId } } },
        { participants: { some: { userId: userBId } } },
      ],
    },
    select: { roomId: true },
  });

  if (!room) {
    return [];
  }

  const rows: MessageRow[] = await prisma.roomMessage.findMany({
    where: {
      roomId: room.roomId,
      ...(beforeMessageId ? { messageId: { lt: beforeMessageId } } : {}),
    },
    orderBy: { messageId: "desc" },
    take: HISTORY_LIMIT,
    select: {
      messageId: true,
      senderId: true,
      content: true,
      sentAt: true,
      readAt: true,
      sender: {
        select: {
          username: true,
        },
      },
    },
  });

  return rows.reverse().map((row) => ({
    ...row,
    roomId: room.roomId,
  }));
}

export { HISTORY_LIMIT };
