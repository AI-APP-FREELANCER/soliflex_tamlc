import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errors";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import ticketsRoutes from "./modules/tickets/tickets.routes";
import maintenanceAssetsRoutes from "./modules/assets-maintenance/maintenance-assets.routes";
import itAssetsRoutes from "./modules/assets-it/it-assets.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import auditRoutes from "./modules/audit/audit.routes";
import helpdeskRoutes from "./modules/helpdesk/helpdesk.routes";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

  app.use("/uploads", express.static(env.uploadDir));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/tickets", ticketsRoutes);
  app.use("/api/assets/maintenance", maintenanceAssetsRoutes);
  app.use("/api/assets/it", itAssetsRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/helpdesk", helpdeskRoutes);

  app.use(errorHandler);

  return app;
}
