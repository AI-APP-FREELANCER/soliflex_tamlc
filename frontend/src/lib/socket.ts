import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";
import { useAuthStore } from "../store/auth.store";

let socket: Socket | null = null;

/**
 * `onDataChanged` fires whenever the server reports that data changed
 * (any ticket/helpdesk/asset/user write by anyone) and after every
 * (re)connect, so a client that was offline catches up straight away.
 */
export function connectSocket(accessToken: string, onDataChanged?: () => void): Socket {
  if (socket) {
    socket.disconnect();
  }
  socket = io(API_BASE_URL, {
    // A function, so every reconnect handshake uses the latest refreshed token.
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? accessToken }),
    withCredentials: true,
  });
  if (onDataChanged) {
    socket.on("data-changed", onDataChanged);
    socket.on("connect", onDataChanged);
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
