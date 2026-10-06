import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 15 MB)." : `Upload failed: ${err.message}`;
    return res.status(400).json({ error: message });
  }
  // Malformed JSON body
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return res.status(404).json({ error: "The requested record was not found" });
    if (err.code === "P2002") return res.status(409).json({ error: "A record with these details already exists" });
    if (err.code === "P2003") return res.status(400).json({ error: "This refers to a record that does not exist" });
  }
  // e.g. an unknown enum value in a query string (?status=BOGUS)
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: "Invalid request parameters" });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
