import fs from "fs";
import path from "path";
import { env } from "../config/env";

/**
 * Storage abstraction. Today this writes to a local disk volume (multer
 * already does the write); this module only resolves the public URL and
 * handles deletion. Swap the implementation for DigitalOcean Spaces (S3
 * client) later without touching callers.
 */

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

export function publicUrlForFile(storedFileName: string): string {
  return `${env.publicUploadBaseUrl}/${storedFileName}`;
}

export function deleteFile(storedFileName: string): void {
  const filePath = path.join(env.uploadDir, storedFileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export const storageRoot = env.uploadDir;
