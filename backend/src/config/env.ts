import dotenv from "dotenv";
import path from "path";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "./uploads"),
  publicUploadBaseUrl: process.env.PUBLIC_UPLOAD_BASE_URL ?? "/uploads",
  /**
   * Maintenance jobs whose spare-part cost is at or above this amount (INR) need
   * manager approval; anything below can be closed by the engineer directly.
   */
  approvalCostThreshold: Number(process.env.APPROVAL_COST_THRESHOLD ?? 2500),
};

export const isProd = env.nodeEnv === "production";
