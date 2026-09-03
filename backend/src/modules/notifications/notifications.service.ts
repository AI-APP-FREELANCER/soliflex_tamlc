import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { emitToUser } from "../../sockets";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function notify(
  tx: Tx,
  userId: string,
  type: NotificationType,
  message: string,
  link?: string
) {
  const notification = await tx.notification.create({
    data: { userId, type, message, link },
  });
  emitToUser(userId, "notification", notification);
  return notification;
}
