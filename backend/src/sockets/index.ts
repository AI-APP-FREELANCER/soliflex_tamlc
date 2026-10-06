import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../lib/jwt";
import { env } from "../config/env";

let io: SocketIOServer | null = null;

export function initSockets(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Not authenticated"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid session"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

const pendingScopes = new Set<string>();
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Tells every connected client that data changed so they refetch immediately.
 * Carries only a scope label, never data - clients re-read through the normal
 * authenticated API, so each user still only sees what they're allowed to.
 * Bursts are coalesced into one event (100ms) to avoid refetch storms.
 */
export function emitDataChanged(scope: string) {
  pendingScopes.add(scope);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    io?.emit("data-changed", { scopes: [...pendingScopes], at: Date.now() });
    pendingScopes.clear();
    flushTimer = null;
  }, 100);
}
