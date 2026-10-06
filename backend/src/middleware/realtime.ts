import type { NextFunction, Request, Response } from "express";
import { emitDataChanged } from "../sockets";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Auth and notification calls don't change anything the dashboards/lists show.
const SCOPES: [prefix: string, scope: string][] = [
  ["/api/tickets", "tickets"],
  ["/api/helpdesk", "helpdesk"],
  ["/api/assets", "assets"],
  ["/api/users", "users"],
];

/**
 * After any successful write, broadcast a "data-changed" signal. Fires on the
 * response `finish` event, i.e. after the handler's transaction has committed,
 * so clients that refetch immediately always read the new data.
 */
export function broadcastDataChanges(req: Request, res: Response, next: NextFunction) {
  if (WRITE_METHODS.has(req.method)) {
    const match = SCOPES.find(([prefix]) => req.originalUrl.startsWith(prefix));
    if (match) {
      res.on("finish", () => {
        if (res.statusCode < 400) emitDataChanged(match[1]);
      });
    }
  }
  next();
}
